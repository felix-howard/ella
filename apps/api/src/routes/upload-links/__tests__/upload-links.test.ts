import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'

vi.mock('../../../lib/db', () => ({
  prisma: {
    taxCase: { findFirst: vi.fn() },
    magicLink: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: vi.fn().mockReturnValue({ route: '/upload-links/test', method: 'POST' }),
  logStaffActivity: vi.fn(),
}))

vi.mock('../../../services/magic-link', () => ({
  createPortalMagicLink: vi.fn().mockResolvedValue({
    id: 'link-new',
    token: 'RANDOM_32_CHAR_TOKEN_VALUE_TEST_123',
    url: 'https://portal.test/upload/RANDOM_32_CHAR_TOKEN_VALUE_TEST_123',
    expiresAt: new Date('2026-07-17T00:00:00.000Z'),
    scope: 'CASE',
    clientGroupId: null,
  }),
  getMagicLinkUrl: vi.fn((token: string) => `https://portal.test/upload/${token}`),
  getMagicLinkStatus: vi.fn((link: {
    isActive: boolean
    expiresAt: Date | null
    revokedAt?: Date | null
    replacedById?: string | null
  }) => {
    if (link.replacedById) return 'REPLACED'
    if (link.revokedAt || !link.isActive) return 'REVOKED'
    if (link.expiresAt && link.expiresAt < new Date('2026-05-18T00:00:00.000Z')) return 'EXPIRED'
    return 'ACTIVE'
  }),
}))

import { prisma } from '../../../lib/db'
import { logStaffActivity } from '../../../services/activity-log'
import { createPortalMagicLink } from '../../../services/magic-link'
import type { AuthVariables } from '../../../middleware/auth'
import { uploadLinksRoute } from '../index'

function testUser() {
  return {
    id: 'clerk_user_1',
    staffId: 'staff_1',
    email: 'staff@test.com',
    name: 'Staff',
    role: 'ADMIN',
    organizationId: 'org_1',
    clerkOrgId: 'org_clerk_1',
    orgRole: 'org:admin',
  }
}

function createApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', testUser())
    await next()
  })
  app.route('/upload-links', uploadLinksRoute)
  return app
}

function mockTaxCase(overrides = {}) {
  return {
    id: 'case_1',
    taxYear: 2025,
    client: {
      id: 'client_1',
      name: 'Tuyet Nguyen',
      organizationId: 'org_1',
      clientGroupId: null,
    },
    ...overrides,
  }
}

function mockLink(overrides = {}) {
  return {
    id: 'link_1',
    caseId: 'case_1',
    token: 'RANDOM_32_CHAR_TOKEN_VALUE_TEST_123',
    type: 'PORTAL',
    scope: 'CASE',
    clientGroupId: null,
    expiresAt: new Date('2026-07-17T00:00:00.000Z'),
    isActive: true,
    revokedAt: null,
    revokedById: null,
    extendedAt: null,
    extendedById: null,
    replacedById: null,
    lastUsedAt: null,
    usageCount: 0,
    createdAt: new Date('2026-05-18T00:00:00.000Z'),
    updatedAt: new Date('2026-05-18T00:00:00.000Z'),
    taxCase: mockTaxCase(),
    ...overrides,
  }
}

describe('uploadLinksRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists scoped upload links without exposing raw tokens', async () => {
    vi.mocked(prisma.taxCase.findFirst).mockResolvedValueOnce(mockTaxCase() as never)
    vi.mocked(prisma.magicLink.findMany).mockResolvedValueOnce([mockLink()] as never)

    const res = await createApp().request('/upload-links/cases/case_1')

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data[0].status).toBe('ACTIVE')
    expect(json.data[0].url).toBe('https://portal.test/upload/RANDOM_32_CHAR_TOKEN_VALUE_TEST_123')
    expect(json.data[0].token).toBeUndefined()
  })

  it('revokes a portal upload link and logs the lifecycle action', async () => {
    const link = mockLink()
    vi.mocked(prisma.magicLink.findFirst).mockResolvedValueOnce(link as never)
    vi.mocked(prisma.magicLink.update).mockResolvedValueOnce({
      ...link,
      isActive: false,
      revokedAt: new Date('2026-05-18T01:00:00.000Z'),
      revokedById: 'staff_1',
    } as never)

    const res = await createApp().request('/upload-links/link_1/revoke', { method: 'POST' })

    expect(res.status).toBe(200)
    expect(prisma.magicLink.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'link_1' },
      data: expect.objectContaining({ isActive: false, revokedById: 'staff_1' }),
    }))
    expect(logStaffActivity).toHaveBeenCalledWith(expect.objectContaining({
      action: 'upload_link.revoked',
      magicLinkId: 'link_1',
    }))
  })

  it('extends an expired active link by an allowed duration', async () => {
    const link = mockLink({ expiresAt: new Date('2026-05-01T00:00:00.000Z') })
    vi.mocked(prisma.magicLink.findFirst).mockResolvedValueOnce(link as never)
    vi.mocked(prisma.magicLink.update).mockResolvedValueOnce({
      ...link,
      expiresAt: new Date('2026-06-17T00:00:00.000Z'),
      extendedAt: new Date('2026-05-18T00:00:00.000Z'),
      extendedById: 'staff_1',
    } as never)

    const res = await createApp().request('/upload-links/link_1/extend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: 30 }),
    })

    expect(res.status).toBe(200)
    expect(prisma.magicLink.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ isActive: true, extendedById: 'staff_1' }),
    }))
  })

  it('generates a replacement portal link for a scoped case', async () => {
    vi.mocked(prisma.taxCase.findFirst).mockResolvedValueOnce(mockTaxCase() as never)
    vi.mocked(prisma.magicLink.findFirst).mockResolvedValueOnce(mockLink({ id: 'link-new' }) as never)

    const res = await createApp().request('/upload-links/cases/case_1/generate', { method: 'POST' })

    expect(res.status).toBe(200)
    expect(createPortalMagicLink).toHaveBeenCalledWith('case_1', {
      scope: 'CASE',
      clientGroupId: undefined,
    })
    expect(logStaffActivity).toHaveBeenCalledWith(expect.objectContaining({
      action: 'upload_link.generated',
      magicLinkId: 'link-new',
    }))
  })
})
