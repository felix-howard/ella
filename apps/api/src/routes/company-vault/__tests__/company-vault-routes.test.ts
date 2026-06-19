/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../middleware/auth'

vi.mock('../../../lib/db', () => ({
  prisma: {
    companyVaultCredential: {
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      findFirstOrThrow: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: vi.fn(() => ({
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
    route: '/company-vault',
    method: 'POST',
  })),
  getChangedFieldNames: vi.fn((input: Record<string, unknown>) =>
    Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key)
  ),
  logStaffActivity: vi.fn(),
}))

import { prisma } from '../../../lib/db'
import { encryptSensitiveValue } from '../../../services/crypto'
import { logStaffActivity } from '../../../services/activity-log'
import { companyVaultRoute } from '../index'

const ENCRYPTION_KEY = 'a'.repeat(64)

function createApp(organizationId: string | null = 'org_1') {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', {
      id: 'clerk_user_1',
      organizationId,
      staffId: 'staff_1',
      email: 'staff@example.com',
      name: 'Staff User',
      role: 'STAFF',
      clerkOrgId: organizationId ? 'clerk_org_1' : null,
      orgRole: 'org:member',
    })
    await next()
  })
  app.route('/company-vault', companyVaultRoute)
  return app
}

function mockCredential(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cred_1',
    organizationId: 'org_1',
    toolName: 'TaxDome',
    usernameEncrypted: encryptSensitiveValue('user@example.com'),
    passwordEncrypted: encryptSensitiveValue('secret-password'),
    noteEncrypted: encryptSensitiveValue('office account'),
    createdAt: new Date('2026-06-18T10:00:00Z'),
    updatedAt: new Date('2026-06-18T10:00:00Z'),
    ...overrides,
  }
}

describe('company vault routes', () => {
  beforeEach(() => {
    process.env.SSN_ENCRYPTION_KEY = ENCRYPTION_KEY
    vi.clearAllMocks()
  })

  it('lists only credentials from the authenticated organization with decrypted values', async () => {
    vi.mocked(prisma.companyVaultCredential.findMany).mockResolvedValueOnce([
      mockCredential(),
    ] as any)

    const res = await createApp().request('/company-vault')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(prisma.companyVaultCredential.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org_1' },
      orderBy: [{ toolName: 'asc' }, { createdAt: 'asc' }],
    })
    expect(json.credentials).toEqual([
      expect.objectContaining({
        id: 'cred_1',
        toolName: 'TaxDome',
        username: 'user@example.com',
        password: 'secret-password',
        note: 'office account',
      }),
    ])
  })

  it('filters search by tool name or decrypted username', async () => {
    vi.mocked(prisma.companyVaultCredential.findMany).mockResolvedValueOnce([
      mockCredential({ id: 'cred_1', toolName: 'TaxDome' }),
      mockCredential({
        id: 'cred_2',
        toolName: 'Drake',
        usernameEncrypted: encryptSensitiveValue('drake-login'),
      }),
    ] as any)

    const res = await createApp().request('/company-vault?search=drake')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.credentials).toHaveLength(1)
    expect(json.credentials[0]).toEqual(expect.objectContaining({
      id: 'cred_2',
      username: 'drake-login',
    }))
  })

  it('creates credentials with encrypted optional fields and safe activity metadata', async () => {
    vi.mocked(prisma.companyVaultCredential.create).mockImplementationOnce((async ({ data }: any) => ({
      id: 'cred_new',
      createdAt: new Date('2026-06-18T10:00:00Z'),
      updatedAt: new Date('2026-06-18T10:00:00Z'),
      ...data,
    })) as any)

    const res = await createApp().request('/company-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolName: 'TaxDome',
        username: 'user@example.com',
        password: 'secret-password',
        note: 'office account',
      }),
    })
    const json = await res.json()
    const createArg = vi.mocked(prisma.companyVaultCredential.create).mock.calls[0][0] as any

    expect(res.status).toBe(201)
    expect(createArg.data.organizationId).toBe('org_1')
    expect(createArg.data.usernameEncrypted).not.toBe('user@example.com')
    expect(createArg.data.passwordEncrypted).not.toBe('secret-password')
    expect(createArg.data.noteEncrypted).not.toBe('office account')
    expect(json.credential).toEqual(expect.objectContaining({
      username: 'user@example.com',
      password: 'secret-password',
      note: 'office account',
    }))
    expect(logStaffActivity).toHaveBeenCalledWith(expect.objectContaining({
      action: 'company_vault.created',
      metadata: { credentialId: 'cred_new' },
    }))
    expect(JSON.stringify(vi.mocked(logStaffActivity).mock.calls[0][0])).not.toContain('secret-password')
  })

  it('normalizes empty optional fields to null on create', async () => {
    vi.mocked(prisma.companyVaultCredential.create).mockImplementationOnce((async ({ data }: any) => ({
      id: 'cred_empty',
      createdAt: new Date('2026-06-18T10:00:00Z'),
      updatedAt: new Date('2026-06-18T10:00:00Z'),
      ...data,
    })) as any)

    const res = await createApp().request('/company-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolName: 'Empty Tool', username: '', password: '', note: '' }),
    })
    const json = await res.json()
    const createArg = vi.mocked(prisma.companyVaultCredential.create).mock.calls[0][0] as any

    expect(res.status).toBe(201)
    expect(createArg.data).toEqual(expect.objectContaining({
      usernameEncrypted: null,
      passwordEncrypted: null,
      noteEncrypted: null,
    }))
    expect(json.credential).toEqual(expect.objectContaining({
      username: null,
      password: null,
      note: null,
    }))
  })

  it('updates by id and organization, records only changed field names', async () => {
    vi.mocked(prisma.companyVaultCredential.updateMany).mockResolvedValueOnce({ count: 1 } as any)
    vi.mocked(prisma.companyVaultCredential.findFirstOrThrow).mockResolvedValueOnce(
      mockCredential({
        toolName: 'Updated Tool',
        usernameEncrypted: null,
      }) as any
    )

    const res = await createApp().request('/company-vault/cred_1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolName: 'Updated Tool', username: null }),
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(prisma.companyVaultCredential.updateMany).toHaveBeenCalledWith({
      where: { id: 'cred_1', organizationId: 'org_1' },
      data: { toolName: 'Updated Tool', usernameEncrypted: null },
    })
    expect(json.credential.username).toBeNull()
    expect(logStaffActivity).toHaveBeenCalledWith(expect.objectContaining({
      action: 'company_vault.updated',
      metadata: {
        credentialId: 'cred_1',
        changedFields: ['toolName', 'username'],
      },
    }))
  })

  it('rejects empty update payloads', async () => {
    const res = await createApp().request('/company-vault/cred_1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
    expect(prisma.companyVaultCredential.updateMany).not.toHaveBeenCalled()
  })

  it('returns 404 when updating a credential outside the organization', async () => {
    vi.mocked(prisma.companyVaultCredential.updateMany).mockResolvedValueOnce({ count: 0 } as any)

    const res = await createApp().request('/company-vault/cred_other', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolName: 'Nope' }),
    })

    expect(res.status).toBe(404)
    expect(prisma.companyVaultCredential.findFirstOrThrow).not.toHaveBeenCalled()
  })

  it('hard deletes credentials by id and organization', async () => {
    vi.mocked(prisma.companyVaultCredential.findFirst).mockResolvedValueOnce(mockCredential() as any)
    vi.mocked(prisma.companyVaultCredential.deleteMany).mockResolvedValueOnce({ count: 1 } as any)

    const res = await createApp().request('/company-vault/cred_1', { method: 'DELETE' })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true })
    expect(prisma.companyVaultCredential.findFirst).toHaveBeenCalledWith({
      where: { id: 'cred_1', organizationId: 'org_1' },
    })
    expect(prisma.companyVaultCredential.deleteMany).toHaveBeenCalledWith({
      where: { id: 'cred_1', organizationId: 'org_1' },
    })
  })

  it('returns 404 when deleting a credential outside the organization', async () => {
    vi.mocked(prisma.companyVaultCredential.findFirst).mockResolvedValueOnce(null)

    const res = await createApp().request('/company-vault/cred_other', { method: 'DELETE' })

    expect(res.status).toBe(404)
    expect(prisma.companyVaultCredential.deleteMany).not.toHaveBeenCalled()
  })

  it('requires an organization context', async () => {
    const res = await createApp(null).request('/company-vault')

    expect(res.status).toBe(403)
    expect(await res.text()).toBe('Please select an organization')
  })
})
