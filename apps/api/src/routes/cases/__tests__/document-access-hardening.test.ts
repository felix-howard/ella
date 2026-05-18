import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { ActivityRiskLevel } from '@ella/db'
import type { AuthVariables } from '../../../middleware/auth'

vi.mock('../../../lib/db', () => ({
  prisma: {
    rawImage: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('../../../services/storage', () => ({
  SENSITIVE_DOC_SIGNED_URL_TTL_SECONDS: 900,
  getSignedDownloadUrl: vi.fn(),
}))

vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: vi.fn(() => ({
    ipAddress: '203.0.113.10',
    userAgent: 'Vitest',
    route: '/cases/images/img_1/signed-url',
    method: 'GET',
  })),
  logStaffActivity: vi.fn(),
}))

vi.mock('../../../lib/inngest', () => ({
  inngest: {
    send: vi.fn(),
  },
}))

vi.mock('../../../services/checklist-generator', () => ({
  generateChecklist: vi.fn(),
}))

vi.mock('../../../services/engagement-helpers', () => ({
  findOrCreateEngagement: vi.fn(),
}))

import { prisma } from '../../../lib/db'
import { getSignedDownloadUrl } from '../../../services/storage'
import { logStaffActivity } from '../../../services/activity-log'
import { casesRoute } from '../index'

const app = new Hono<{ Variables: AuthVariables }>()
app.use('*', async (c, next) => {
  c.set('user', {
    id: 'clerk_user_1',
    organizationId: 'org_1',
    staffId: 'staff_1',
    email: 'staff@example.com',
    name: 'Staff User',
    role: 'STAFF',
    clerkOrgId: 'clerk_org_1',
    orgRole: 'org:member',
  })
  await next()
})
app.route('/cases', casesRoute)

function mockImage() {
  return {
    id: 'img_1',
    caseId: 'case_1',
    r2Key: 'cases/case_1/docs/private.pdf',
    filename: 'private.pdf',
    mimeType: 'application/pdf',
    status: 'CLASSIFIED',
    classifiedType: 'W2',
    category: 'INCOME',
    isStorageDeleted: false,
    storageDeletedAt: null,
    retentionDeletedAt: null,
    taxCase: {
      client: {
        id: 'client_1',
        organizationId: 'org_1',
      },
    },
  }
}

describe('document access hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.rawImage.findFirst).mockResolvedValue(mockImage() as never)
    vi.mocked(getSignedDownloadUrl).mockResolvedValue('https://signed.example.com/file.pdf')
  })

  it('generates staff document signed URLs with a 15-minute TTL and audit event', async () => {
    const res = await app.request('/cases/images/img_1/signed-url')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.expiresIn).toBe(900)
    expect(getSignedDownloadUrl).toHaveBeenCalledWith('cases/case_1/docs/private.pdf', 900)
    expect(logStaffActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        clientId: 'client_1',
        caseId: 'case_1',
        rawImageId: 'img_1',
        actorStaffId: 'staff_1',
        action: 'DOCUMENT_SIGNED_URL_CREATED',
        riskLevel: ActivityRiskLevel.MEDIUM,
      })
    )
  })

  it('proxies staff document files with no-store headers and audit event', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('pdf bytes', {
          status: 200,
          headers: { 'content-type': 'application/pdf' },
        })
      )
    )

    const res = await app.request('/cases/images/img_1/file')
    const text = await res.text()

    expect(res.status).toBe(200)
    expect(text).toBe('pdf bytes')
    expect(getSignedDownloadUrl).toHaveBeenCalledWith('cases/case_1/docs/private.pdf', 900)
    expect(res.headers.get('cache-control')).toBe('private, no-store, max-age=0')
    expect(res.headers.get('pragma')).toBe('no-cache')
    expect(res.headers.get('expires')).toBe('0')
    expect(logStaffActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DOCUMENT_FILE_PROXIED',
        riskLevel: ActivityRiskLevel.MEDIUM,
      })
    )

    vi.unstubAllGlobals()
  })
})
