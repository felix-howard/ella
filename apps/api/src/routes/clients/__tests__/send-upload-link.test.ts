/**
 * Send Upload Link Unit Tests
 * Tests POST /clients/:id/send-upload-link
 * Covers: business→individual redirect, fallback, SMS delivery
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
vi.mock('../../../lib/db', () => ({
  prisma: {
    client: {
      findFirst: vi.fn(),
    },
    magicLink: {
      findFirst: vi.fn(),
    },
  },
}))

// Mock services
vi.mock('../../../services/magic-link', () => ({
  createMagicLink: vi.fn().mockResolvedValue('https://portal.ellatax.com/upload/test-token'),
  getMagicLinkUrl: vi.fn().mockImplementation((token: string) => `https://portal.ellatax.com/upload/${token}`),
  createPortalMagicLink: vi.fn().mockResolvedValue({
    id: 'link_1',
    token: 'test-token',
    url: 'https://portal.ellatax.com/upload/test-token',
    expiresAt: new Date('2026-07-17T00:00:00.000Z'),
    scope: 'CASE',
    clientGroupId: null,
  }),
  upgradeActivePortalLinksToGroup: vi.fn(),
}))

vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: vi.fn().mockReturnValue({ route: '/clients/test/send-upload-link', method: 'POST' }),
  logStaffActivity: vi.fn(),
}))

vi.mock('../../../services/sms', () => ({
  isSmsEnabled: vi.fn().mockReturnValue(true),
  sendWelcomeMessage: vi.fn().mockResolvedValue({ smsSent: true, messageId: 'msg_1' }),
  getOrgSmsLanguage: vi.fn(),
}))

vi.mock('../../../services/storage', () => ({
  getSignedUploadUrl: vi.fn(),
  generateClientAvatarKey: vi.fn(),
  resolveAvatarUrl: vi.fn().mockImplementation((url: string | null) => Promise.resolve(url)),
}))

vi.mock('../../../middleware/auth', () => ({
  requireOrg: async (_c: unknown, next: () => Promise<void>) => next(),
  requireOrgAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
  requireAdminOrManager: async (_c: unknown, next: () => Promise<void>) => next(),
}))

vi.mock('../../../middleware/rate-limiter', () => ({
  rateLimiter: () => async (_c: unknown, next: () => Promise<void>) => next(),
}))

vi.mock('../../../lib/org-scope', () => ({
  buildClientScopeFilter: vi.fn().mockReturnValue({ organizationId: 'org_1' }),
  canSeeAllClients: vi.fn().mockReturnValue(true),
}))

vi.mock('../../../services/checklist-generator', () => ({
  generateChecklist: vi.fn(),
  cascadeCleanupOnFalse: vi.fn(),
  refreshChecklist: vi.fn(),
}))

vi.mock('../../../services/audit-logger', () => ({
  logProfileChanges: vi.fn(),
  computeIntakeAnswersDiff: vi.fn(),
  computeProfileFieldDiff: vi.fn(),
}))

vi.mock('../../../services/engagement-helpers', () => ({
  findOrCreateEngagement: vi.fn(),
}))

vi.mock('../../../services/crypto', () => ({
  encryptSSN: vi.fn(),
  maskEIN: vi.fn(),
}))

import { Hono } from 'hono'
import { prisma } from '../../../lib/db'
import { createPortalMagicLink } from '../../../services/magic-link'
import { sendWelcomeMessage, isSmsEnabled } from '../../../services/sms'
import type { AuthVariables } from '../../../middleware/auth'
import { clientsRoute } from '../index'

function createApp(user = defaultUser()) {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', user)
    await next()
  })
  app.route('/clients', clientsRoute)
  return app
}

function defaultUser() {
  return {
    id: 'clerk_user_1',
    staffId: 'staff_1',
    email: 'admin@test.com',
    name: 'Admin',
    role: 'ADMIN',
    organizationId: 'org_1',
    clerkOrgId: 'org_clerk_1',
    orgRole: 'org:admin',
  }
}

// CUID-format test IDs (must match /^c[a-z0-9]{24}$/)
const CID_IND = 'cabcdefghij1234567890ind0'
const CID_BIZ = 'cabcdefghij1234567890biz0'
const CASE_IND = 'cabcdefghij123456case0ind'
const CASE_BIZ = 'cabcdefghij123456case0biz'
const CASE_OLD = 'cabcdefghij123456case0old'
const CID_NOCASE = 'cabcdefghij12345678nocase'

describe('POST /clients/:id/send-upload-link', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.magicLink.findFirst).mockResolvedValue(null as never)
    vi.mocked(createPortalMagicLink).mockResolvedValue({
      id: 'link_1',
      token: 'test-token',
      url: 'https://portal.ellatax.com/upload/test-token',
      expiresAt: new Date('2026-07-17T00:00:00.000Z'),
      scope: 'CASE',
      clientGroupId: null,
    })
  })

  it('sends SMS to individual directly (no redirect needed)', async () => {
    const mockClient = {
      id: CID_IND,
      name: 'Tuyet Nguyen',
      phone: '+14155550101',
      language: 'VI',
      clientType: 'INDIVIDUAL',
      clientGroupId: null,
      taxCases: [{ id: CASE_IND, taxYear: 2025 }],
    }

    vi.mocked(prisma.client.findFirst).mockResolvedValueOnce(mockClient as never)

    const app = createApp()
    const res = await app.request(`/clients/${CID_IND}/send-upload-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)

    expect(createPortalMagicLink).toHaveBeenCalledWith(CASE_IND, {
      scope: 'CASE',
      clientGroupId: undefined,
    })
    expect(sendWelcomeMessage).toHaveBeenCalledWith(
      CASE_IND,
      'Tuyet Nguyen',
      '+14155550101',
      'https://portal.ellatax.com/upload/test-token',
      2025,
      'VI',
      undefined,
      'staff_1',
    )
  })

  it('uses requested targetCaseId instead of the latest case', async () => {
    const mockClient = {
      id: CID_IND,
      name: 'Tuyet Nguyen',
      phone: '+14155550101',
      language: 'VI',
      clientType: 'INDIVIDUAL',
      clientGroupId: null,
      taxCases: [
        { id: CASE_IND, taxYear: 2025 },
        { id: CASE_OLD, taxYear: 2024 },
      ],
    }

    vi.mocked(prisma.client.findFirst).mockResolvedValueOnce(mockClient as never)

    const app = createApp()
    const res = await app.request(`/clients/${CID_IND}/send-upload-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetCaseId: CASE_OLD }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.targetCaseId).toBe(CASE_OLD)
    expect(createPortalMagicLink).toHaveBeenCalledWith(CASE_OLD, {
      scope: 'CASE',
      clientGroupId: undefined,
    })
    expect(sendWelcomeMessage).toHaveBeenCalledWith(
      CASE_OLD,
      'Tuyet Nguyen',
      '+14155550101',
      'https://portal.ellatax.com/upload/test-token',
      2024,
      'VI',
      undefined,
      'staff_1',
    )
  })

  it('resends SMS with an existing active link without replacing it', async () => {
    const mockClient = {
      id: CID_IND,
      name: 'Tuyet Nguyen',
      phone: '+14155550101',
      language: 'VI',
      clientType: 'INDIVIDUAL',
      clientGroupId: null,
      taxCases: [{ id: CASE_IND, taxYear: 2025 }],
    }

    vi.mocked(prisma.client.findFirst).mockResolvedValueOnce(mockClient as never)
    vi.mocked(prisma.magicLink.findFirst).mockResolvedValueOnce({
      id: 'link_existing',
      token: 'existing-token',
      expiresAt: new Date('2026-07-17T00:00:00.000Z'),
      scope: 'CASE',
      clientGroupId: null,
    } as never)

    const app = createApp()
    const res = await app.request(`/clients/${CID_IND}/send-upload-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(200)
    expect(createPortalMagicLink).not.toHaveBeenCalled()
    expect(sendWelcomeMessage).toHaveBeenCalledWith(
      CASE_IND,
      'Tuyet Nguyen',
      '+14155550101',
      'https://portal.ellatax.com/upload/existing-token',
      2025,
      'VI',
      undefined,
      'staff_1',
    )
  })

  it('redirects business → individual phone + taxCase', async () => {
    const mockBusiness = {
      id: CID_BIZ,
      name: 'Landa Nails',
      phone: '+18005551234',
      language: 'EN',
      clientType: 'BUSINESS',
      clientGroupId: 'group_1',
      taxCases: [{ id: CASE_BIZ, taxYear: 2025 }],
    }

    const mockIndividual = {
      id: CID_IND,
      phone: '+14155550101',
      name: 'Tuyet Nguyen',
      language: 'VI',
      taxCases: [{ id: CASE_IND }],
    }

    vi.mocked(prisma.client.findFirst)
      .mockResolvedValueOnce(mockBusiness as never)
      .mockResolvedValueOnce(mockIndividual as never)

    const app = createApp()
    const res = await app.request(`/clients/${CID_BIZ}/send-upload-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(200)
    expect(createPortalMagicLink).toHaveBeenCalledWith(CASE_IND, {
      scope: 'GROUP',
      clientGroupId: 'group_1',
    })
    expect(sendWelcomeMessage).toHaveBeenCalledWith(
      CASE_IND,
      'Tuyet Nguyen',
      '+14155550101',
      'https://portal.ellatax.com/upload/test-token',
      2025,
      'VI',
      undefined,
      'staff_1',
    )
  })

  it('falls back to business case when individual has no taxCase for year', async () => {
    const mockBusiness = {
      id: CID_BIZ,
      name: 'Landa Nails',
      phone: '+18005551234',
      language: 'EN',
      clientType: 'BUSINESS',
      clientGroupId: 'group_1',
      taxCases: [{ id: CASE_BIZ, taxYear: 2025 }],
    }

    const mockIndividual = {
      id: CID_IND,
      phone: '+14155550101',
      name: 'Tuyet Nguyen',
      language: 'VI',
      taxCases: [],
    }

    vi.mocked(prisma.client.findFirst)
      .mockResolvedValueOnce(mockBusiness as never)
      .mockResolvedValueOnce(mockIndividual as never)

    const app = createApp()
    const res = await app.request(`/clients/${CID_BIZ}/send-upload-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(200)
    expect(createPortalMagicLink).toHaveBeenCalledWith(CASE_BIZ, {
      scope: 'GROUP',
      clientGroupId: 'group_1',
    })
    expect(sendWelcomeMessage).toHaveBeenCalledWith(
      CASE_BIZ,
      'Tuyet Nguyen',
      '+14155550101',
      'https://portal.ellatax.com/upload/test-token',
      2025,
      'VI',
      undefined,
      'staff_1',
    )
  })

  it('falls back to business phone when no individual in group', async () => {
    const mockBusiness = {
      id: CID_BIZ,
      name: 'Landa Nails',
      phone: '+18005551234',
      language: 'EN',
      clientType: 'BUSINESS',
      clientGroupId: 'group_1',
      taxCases: [{ id: CASE_BIZ, taxYear: 2025 }],
    }

    vi.mocked(prisma.client.findFirst)
      .mockResolvedValueOnce(mockBusiness as never)
      .mockResolvedValueOnce(null as never)

    const app = createApp()
    const res = await app.request(`/clients/${CID_BIZ}/send-upload-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(200)
    expect(createPortalMagicLink).toHaveBeenCalledWith(CASE_BIZ, {
      scope: 'GROUP',
      clientGroupId: 'group_1',
    })
    expect(sendWelcomeMessage).toHaveBeenCalledWith(
      CASE_BIZ,
      'Landa Nails',
      '+18005551234',
      'https://portal.ellatax.com/upload/test-token',
      2025,
      'EN',
      undefined,
      'staff_1',
    )
  })

  it('returns 404 when client not found', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValueOnce(null as never)

    const app = createApp()
    const res = await app.request(`/clients/${CID_IND}/send-upload-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(404)
  })

  it('returns 400 when client has no tax case', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValueOnce({
      id: CID_NOCASE,
      name: 'Test',
      phone: '+10000000000',
      language: 'EN',
      clientType: 'INDIVIDUAL',
      clientGroupId: null,
      taxCases: [],
    } as never)

    const app = createApp()
    const res = await app.request(`/clients/${CID_NOCASE}/send-upload-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
  })

  it('returns 500 when SMS is disabled', async () => {
    vi.mocked(isSmsEnabled).mockReturnValueOnce(false)

    vi.mocked(prisma.client.findFirst).mockResolvedValueOnce({
      id: CID_IND,
      name: 'Test',
      phone: '+10000000000',
      language: 'EN',
      clientType: 'INDIVIDUAL',
      clientGroupId: null,
      taxCases: [{ id: CASE_IND, taxYear: 2025 }],
    } as never)

    const app = createApp()
    const res = await app.request(`/clients/${CID_IND}/send-upload-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(500)
  })

  it('resend-sms only selects unexpired active portal links', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValueOnce({
      id: CID_IND,
      name: 'Test',
      phone: '+10000000000',
      language: 'EN',
      taxCases: [],
    } as never)

    const app = createApp()
    const res = await app.request(`/clients/${CID_IND}/resend-sms`, {
      method: 'POST',
    })

    expect(res.status).toBe(200)
    expect(prisma.client.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({
        taxCases: expect.objectContaining({
          include: expect.objectContaining({
            magicLinks: expect.objectContaining({
              where: expect.objectContaining({
                isActive: true,
                type: 'PORTAL',
                revokedAt: null,
                replacedById: null,
                OR: expect.arrayContaining([
                  { expiresAt: null },
                  { expiresAt: expect.objectContaining({ gt: expect.any(Date) }) },
                ]),
              }),
            }),
          }),
        }),
      }),
    }))
  })
})
