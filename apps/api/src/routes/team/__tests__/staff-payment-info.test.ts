import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../lib/db', () => ({
  prisma: {
    staff: { findFirst: vi.fn() },
    staffPaymentInfo: { upsert: vi.fn(), deleteMany: vi.fn() },
    client: { findMany: vi.fn() },
  },
}))
vi.mock('../../../services/storage', () => ({
  getSignedUploadUrl: vi.fn(),
  generateAvatarKey: vi.fn(),
  generateStaffFileKey: vi.fn(),
  getSignedDownloadUrl: vi.fn(),
  resolveAvatarUrl: vi.fn((url: string | null) => Promise.resolve(url)),
}))
vi.mock('../../../lib/config', () => ({ config: { workspaceUrl: 'http://localhost:5174' } }))
vi.mock('../../../lib/clerk-client', () => ({
  clerkClient: {
    organizations: {
      createOrganizationInvitation: vi.fn(),
      updateOrganizationMembership: vi.fn(),
      deleteOrganizationMembership: vi.fn(),
      getOrganizationInvitationList: vi.fn(),
      revokeOrganizationInvitation: vi.fn(),
    },
    users: { updateUser: vi.fn() },
  },
}))
vi.mock('../../../services/auth', () => ({ deactivateStaff: vi.fn() }))
vi.mock('../../../services/audit-logger', () => ({ logTeamAction: vi.fn() }))
vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: vi.fn(() => ({ ipAddress: '127.0.0.1', userAgent: 'vitest' })),
  getChangedFieldNames: vi.fn(),
  logStaffActivity: vi.fn(),
}))
vi.mock('../../../services/crypto', () => ({
  decryptSSN: vi.fn((value: string) => value.replace(/^enc:/, '')),
  encryptSSN: vi.fn((value: string) => `enc:${value}`),
}))
vi.mock('../../../middleware/auth', () => ({
  requireOrg: async (_c: unknown, next: () => Promise<void>) => next(),
  requireOrgAdmin: async (
    c: { get: (key: string) => { orgRole?: string | null; role?: string | null }; json: (body: unknown, status?: number) => Response },
    next: () => Promise<void>
  ) => {
    const user = c.get('user')
    return user?.orgRole === 'org:admin' || user?.role === 'ADMIN'
      ? next()
      : c.json({ error: 'Chỉ admin mới có quyền' }, 403)
  },
}))

import { Hono } from 'hono'
import { prisma } from '../../../lib/db'
import { logStaffActivity } from '../../../services/activity-log'
import type { AuthVariables } from '../../../middleware/auth'
import { teamRoute } from '../index'

function user(overrides: Partial<AuthVariables['user']> = {}): AuthVariables['user'] {
  return {
    id: 'clerk_user_1', staffId: 'staff_1', email: 'admin@test.com', name: 'Admin',
    role: 'ADMIN', organizationId: 'org_db_1', clerkOrgId: 'org_clerk_1', orgRole: 'org:admin',
    ...overrides,
  }
}

function appFor(authUser: AuthVariables['user'] = user()) {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', authUser)
    await next()
  })
  app.route('/team', teamRoute)
  return app
}

function staff(overrides: Record<string, unknown> = {}) {
  return {
    id: 'staff_2', name: 'Member B', email: 'b@test.com', role: 'STAFF',
    isContractorAgent: false, avatarUrl: null, phoneNumber: null, title: null,
    notifyOnUpload: false, notifyOnChat: false, notifyOnAgreementSigned: false,
    notifyOnClientPayment: false, formSlug: null, autoSendUploadLink: false,
    defaultUploadLinkTemplateId: null, isActive: true, deactivatedAt: null, paymentInfos: [],
    _count: { managedClientLinks: 0 },
    ...overrides,
  }
}

const validPaymentBody = {
  nameOnAccount: 'Member B',
  bankName: 'Chase',
  accountNumber: '000123456789',
  routingNumber: '021000021',
}

describe('staff payment info routes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns decrypted payment account numbers on profile', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce(staff({
      paymentInfos: [{
        country: 'PH',
        nameOnAccount: 'Member B',
        bankName: 'BDO',
        accountNumberEncrypted: 'enc:123456275',
        accountNumberLast4: '6275',
        routingNumberEncrypted: null,
        routingNumberLast4: null,
        updatedAt: new Date('2026-06-14T12:00:00.000Z'),
      }],
    }) as never)
    vi.mocked(prisma.client.findMany).mockResolvedValueOnce([] as never)

    const res = await appFor().request('/team/members/staff_2/profile')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.staff.paymentInfos).toEqual([{
      country: 'PH', nameOnAccount: 'Member B', bankName: 'BDO',
      accountNumber: '123456275', routingNumber: null,
      accountNumberLast4: '6275', routingNumberLast4: null,
      updatedAt: '2026-06-14T12:00:00.000Z',
    }])
    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain('accountNumberEncrypted')
    expect(serialized).not.toContain('routingNumberEncrypted')
    expect(serialized).toContain('123456275')
  })

  it('saves own US payment info encrypted and returns decrypted values', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({ id: 'staff_2' } as never)
    vi.mocked(prisma.staffPaymentInfo.upsert).mockResolvedValueOnce({
      country: 'US',
      nameOnAccount: 'Member B',
      bankName: 'Chase',
      accountNumberEncrypted: 'enc:000123456789',
      accountNumberLast4: '6789',
      routingNumberEncrypted: 'enc:021000021',
      routingNumberLast4: '0021',
      updatedAt: new Date('2026-06-14T12:00:00.000Z'),
    } as never)

    const member = user({ staffId: 'staff_2', role: 'STAFF', orgRole: 'org:member' })
    const res = await appFor(member).request('/team/members/me/payment-info/US', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPaymentBody),
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(prisma.staffPaymentInfo.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        organizationId: 'org_db_1',
        staffId: 'staff_2',
        accountNumberEncrypted: 'enc:000123456789',
        routingNumberEncrypted: 'enc:021000021',
      }),
    }))
    expect(body.paymentInfo).toEqual(expect.objectContaining({
      country: 'US',
      accountNumber: '000123456789',
      accountNumberLast4: '6789',
      routingNumber: '021000021',
      routingNumberLast4: '0021',
    }))
    expect(JSON.stringify(vi.mocked(logStaffActivity).mock.calls)).not.toContain('000123456789')
    expect(JSON.stringify(vi.mocked(logStaffActivity).mock.calls)).not.toContain('021000021')
  })

  it('lets an admin save another staff member payment info', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({ id: 'staff_2' } as never)
    vi.mocked(prisma.staffPaymentInfo.upsert).mockResolvedValueOnce({
      country: 'VN',
      nameOnAccount: 'Member B',
      bankName: 'VCB',
      accountNumberEncrypted: 'enc:1234567890',
      accountNumberLast4: '7890',
      routingNumberEncrypted: null,
      routingNumberLast4: null,
      updatedAt: new Date('2026-06-14T12:00:00.000Z'),
    } as never)

    const res = await appFor().request('/team/members/staff_2/payment-info/VN', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nameOnAccount: 'Member B', bankName: 'VCB', accountNumber: '1234567890' }),
    })

    expect(res.status).toBe(200)
    expect(prisma.staffPaymentInfo.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ organizationId: 'org_db_1', staffId: 'staff_2', country: 'VN' }),
    }))
  })

  it.each([
    ['US', { ...validPaymentBody, routingNumber: '123456789' }],
    ['VN', { nameOnAccount: 'Member B', bankName: 'VCB', accountNumber: '12345' }],
    ['PH', { nameOnAccount: 'Member B', bankName: 'BDO', accountNumber: '1234567890', routingNumber: '021000021' }],
  ])('rejects invalid %s payment info before write', async (country, body) => {
    const member = user({ staffId: 'staff_2', role: 'STAFF', orgRole: 'org:member' })
    const res = await appFor(member).request(`/team/members/me/payment-info/${country}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    expect(res.status).toBe(400)
    expect(prisma.staffPaymentInfo.upsert).not.toHaveBeenCalled()
  })

  it('rejects unsupported payment countries before write', async () => {
    const res = await appFor().request('/team/members/staff_2/payment-info/CA', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPaymentBody),
    })

    expect(res.status).toBe(400)
    expect(prisma.staffPaymentInfo.upsert).not.toHaveBeenCalled()
  })

  it('blocks non-admin staff from editing another member', async () => {
    const member = user({ staffId: 'staff_2', role: 'STAFF', orgRole: 'org:member' })
    const res = await appFor(member).request('/team/members/staff_1/payment-info/VN', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nameOnAccount: 'Member B', bankName: 'VCB', accountNumber: '1234567890' }),
    })

    expect(res.status).toBe(403)
    expect(prisma.staff.findFirst).not.toHaveBeenCalled()
    expect(prisma.staffPaymentInfo.upsert).not.toHaveBeenCalled()
  })

  it('blocks non-admin staff from clearing another member', async () => {
    const member = user({ staffId: 'staff_2', role: 'STAFF', orgRole: 'org:member' })
    const res = await appFor(member).request('/team/members/staff_1/payment-info/VN', { method: 'DELETE' })

    expect(res.status).toBe(403)
    expect(prisma.staffPaymentInfo.deleteMany).not.toHaveBeenCalled()
  })

  it('clears one country with organization scope', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({ id: 'staff_2' } as never)
    vi.mocked(prisma.staffPaymentInfo.deleteMany).mockResolvedValueOnce({ count: 1 } as never)

    const res = await appFor().request('/team/members/staff_2/payment-info/PH', { method: 'DELETE' })

    expect(res.status).toBe(200)
    expect(prisma.staffPaymentInfo.deleteMany).toHaveBeenCalledWith({
      where: { organizationId: 'org_db_1', staffId: 'staff_2', country: 'PH' },
    })
    expect(await res.json()).toEqual({ success: true, country: 'PH', deleted: true })
  })
})
