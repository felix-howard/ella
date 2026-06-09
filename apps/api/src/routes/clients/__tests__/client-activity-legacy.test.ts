import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/db', () => ({
  prisma: {
    client: {
      findFirst: vi.fn(),
    },
    taxCase: {
      findMany: vi.fn(),
    },
    rawImage: {
      findMany: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
    },
  },
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

vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: vi.fn().mockReturnValue({ route: '/clients/test/activity', method: 'GET' }),
  getChangedFieldNames: vi.fn().mockReturnValue([]),
  logStaffActivity: vi.fn(),
}))

vi.mock('../../../services/storage', () => ({
  generateClientAvatarKey: vi.fn(),
  getSignedUploadUrl: vi.fn(),
  resolveAvatarUrl: vi.fn().mockResolvedValue(null),
}))

vi.mock('../../../services/checklist-generator', () => ({
  cascadeCleanupOnFalse: vi.fn(),
  generateChecklist: vi.fn(),
  refreshChecklist: vi.fn(),
}))

vi.mock('../../../services/audit-logger', () => ({
  computeIntakeAnswersDiff: vi.fn().mockReturnValue([]),
  computeProfileFieldDiff: vi.fn().mockReturnValue([]),
  logProfileChanges: vi.fn(),
}))

vi.mock('../../../services/engagement-helpers', () => ({
  findOrCreateEngagement: vi.fn(),
}))

vi.mock('../../../services/crypto', () => ({
  encryptSSN: vi.fn(),
  maskEIN: vi.fn(),
}))

vi.mock('../../../services/magic-link', () => ({
  createMagicLink: vi.fn(),
  createPortalMagicLink: vi.fn(),
  getMagicLinkUrl: vi.fn(),
  upgradeActivePortalLinksToGroup: vi.fn(),
}))

vi.mock('../../../services/sms', () => ({
  getOrgSmsLanguage: vi.fn(),
  isSmsEnabled: vi.fn().mockReturnValue(false),
  sendWelcomeMessage: vi.fn(),
}))

import { prisma } from '../../../lib/db'
import type { AuthVariables } from '../../../middleware/auth'
import { clientsRoute } from '../index'

const CLIENT_ID = 'cabcdefghij1234567890abc0'
const CASE_ID = 'cabcdefghij123456case0abc'

function createApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', {
      id: 'clerk_user_1',
      staffId: 'staff_1',
      email: 'admin@test.com',
      name: 'Admin',
      role: 'ADMIN',
      organizationId: 'org_1',
      clerkOrgId: 'org_clerk_1',
      orgRole: 'org:admin',
    })
    await next()
  })
  app.route('/clients', clientsRoute)
  return app
}

describe('GET /clients/:id/activity legacy fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not expose message body snippets', async () => {
    vi.mocked(prisma.client.findFirst).mockResolvedValueOnce({ id: CLIENT_ID } as never)
    vi.mocked(prisma.taxCase.findMany)
      .mockResolvedValueOnce([{ id: CASE_ID }] as never)
      .mockResolvedValueOnce([] as never)
    vi.mocked(prisma.rawImage.findMany).mockResolvedValueOnce([] as never)
    vi.mocked(prisma.message.findMany).mockResolvedValueOnce([
      {
        id: 'msg_1',
        direction: 'INBOUND',
        channel: 'SMS',
        callStatus: null,
        recordingDuration: null,
        createdAt: new Date('2026-05-20T10:00:00.000Z'),
      },
      {
        id: 'msg_2',
        direction: 'OUTBOUND',
        channel: 'PORTAL',
        callStatus: null,
        recordingDuration: null,
        createdAt: new Date('2026-05-20T09:00:00.000Z'),
      },
    ] as never)

    const res = await createApp().request(`/clients/${CLIENT_ID}/activity`)

    expect(res.status).toBe(200)
    expect(vi.mocked(prisma.message.findMany).mock.calls[0][0]).toMatchObject({
      select: expect.not.objectContaining({ content: true }),
    })
    const json = await res.json()
    expect(json.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'msg_1', description: 'Client sent a message' }),
        expect.objectContaining({ id: 'msg_2', description: 'Staff sent a message' }),
      ]),
    )
    expect(JSON.stringify(json)).not.toContain('secret')
  })
})
