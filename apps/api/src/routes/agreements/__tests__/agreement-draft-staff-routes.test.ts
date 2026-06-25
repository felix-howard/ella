import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthUser } from '../../../middleware/auth'

interface TestAuthContext {
  set: (key: 'user', value: AuthUser) => void
}

const AUTH_USER = {
  id: 'clerk-1',
  staffId: 'staff-1',
  email: 'staff@test.com',
  name: 'Staff User',
  role: 'ORG_ADMIN',
  organizationId: 'org-1',
  clerkOrgId: 'org_clerk_1',
  orgRole: 'org:admin',
} satisfies AuthUser

const serviceMocks = vi.hoisted(() => ({
  createAgreementForEntity: vi.fn(),
  createAgreementDraftForEntity: vi.fn(),
  discardAgreementDraftForEntity: vi.fn(),
  extendAgreementForEntity: vi.fn(),
  getDefaultHtmlForEntity: vi.fn(),
  getPresignedPdfUrlForEntity: vi.fn(),
  listAgreementsForEntity: vi.fn(),
  renderPreviewPdf: vi.fn(),
  resendAgreementForEntity: vi.fn(),
  sendAgreementDraftForEntity: vi.fn(),
  storeUploadedPdf: vi.fn(),
  stripAgreementToken: vi.fn((agreement: { token?: unknown }) => {
    const { token: _token, ...rest } = agreement
    void _token
    return rest
  }),
  updateAgreementDraftForEntity: vi.fn(),
  updateDepositForEntity: vi.fn(),
}))

vi.mock('../../../services/agreements/agreement-service', () => serviceMocks)

vi.mock('../../../middleware/auth', () => ({
  authMiddleware: async (c: TestAuthContext, next: () => Promise<void>) => {
    c.set('user', AUTH_USER)
    await next()
  },
  requireAdminOrManager: async (_c: unknown, next: () => Promise<void>) => next(),
}))

import { staffRoute } from '../staff-handlers'
import {
  createAgreementDraftForEntity,
  sendAgreementDraftForEntity,
  updateAgreementDraftForEntity,
} from '../../../services/agreements/agreement-service'

const app = new Hono()
app.route('/leads', staffRoute)

const expectedUpdatedAt = '2026-06-25T10:00:00.000Z'

function draft(overrides: Record<string, unknown> = {}) {
  return {
    id: 'draft-1',
    token: 'tok_should_not_leave_route',
    status: 'DRAFT',
    type: 'ENGAGEMENT_LETTER',
    updatedAt: expectedUpdatedAt,
    ...overrides,
  }
}

describe('lead agreement draft staff routes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates lead drafts through the shared draft service without returning a public url', async () => {
    vi.mocked(createAgreementDraftForEntity).mockResolvedValueOnce(draft() as never)

    const res = await app.request('/leads/lead-1/agreements/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'ENGAGEMENT_LETTER',
        title: '2026 Engagement',
        contentHtml: '<p>Scope</p>',
        depositAmount: '125.00',
        internalNote: 'Private',
        expiryDays: 30,
        source: 'CALCULATOR',
        sourceSnapshot: { quoteId: 'quote-1' },
      }),
    })
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.url).toBeUndefined()
    expect(json.data.id).toBe('draft-1')
    expect(json.data.token).toBeUndefined()
    expect(createAgreementDraftForEntity).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'lead',
      entityId: 'lead-1',
      orgId: 'org-1',
      staffId: 'staff-1',
      type: 'ENGAGEMENT_LETTER',
      title: '2026 Engagement',
      source: 'CALCULATOR',
      sourceSnapshot: { quoteId: 'quote-1' },
    }))
  })

  it('updates lead drafts with freshness metadata and keeps creator ownership in service layer', async () => {
    vi.mocked(updateAgreementDraftForEntity).mockResolvedValueOnce(draft({ title: 'Updated' }) as never)

    const res = await app.request('/leads/lead-1/agreements/draft-1/draft', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedUpdatedAt,
        type: 'ENGAGEMENT_LETTER',
        contentHtml: '<p>Updated scope</p>',
      }),
    })

    expect(res.status).toBe(200)
    expect((await res.clone().json()).data.token).toBeUndefined()
    expect(updateAgreementDraftForEntity).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'lead',
      entityId: 'lead-1',
      agreementId: 'draft-1',
      orgId: 'org-1',
      staffId: 'staff-1',
      expectedUpdatedAt,
      contentHtml: '<p>Updated scope</p>',
    }))
  })

  it('sends lead drafts through the guarded draft-send service and returns that one-time url', async () => {
    vi.mocked(sendAgreementDraftForEntity).mockResolvedValueOnce({
      agreement: draft({ status: 'SENT' }),
      url: 'https://portal.test/agreements/tok_123',
    } as never)

    const res = await app.request('/leads/lead-1/agreements/draft-1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expectedUpdatedAt,
        type: 'ENGAGEMENT_LETTER',
        contentHtml: '<p>Final scope</p>',
      }),
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.url).toBe('https://portal.test/agreements/tok_123')
    expect(json.data.token).toBeUndefined()
    expect(sendAgreementDraftForEntity).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'lead',
      entityId: 'lead-1',
      agreementId: 'draft-1',
      orgId: 'org-1',
      staffId: 'staff-1',
      expectedUpdatedAt,
      contentHtml: '<p>Final scope</p>',
    }))
  })
})
