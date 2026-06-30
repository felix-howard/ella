import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthUser, AuthVariables } from '../../../middleware/auth'

vi.mock('../../../services/agreements/agreement-service', () => ({
  createAgreementForEntity: vi.fn(),
  createAgreementDraftForEntity: vi.fn(),
  discardAgreementDraftForEntity: vi.fn(),
  getDefaultHtmlForEntity: vi.fn(),
  updateDepositForEntity: vi.fn(),
  getPresignedPdfUrlForEntity: vi.fn(),
  resendAgreementForEntity: vi.fn(),
  sendAgreementPaymentPortalForEntity: vi.fn(),
  voidAgreementForEntity: vi.fn(),
  extendAgreementForEntity: vi.fn(),
  renderPreviewPdf: vi.fn(),
  sendAgreementDraftForEntity: vi.fn(),
  storeUploadedPdf: vi.fn(),
  stripAgreementToken: vi.fn((agreement: { token?: unknown }) => {
    const { token: _token, ...rest } = agreement
    void _token
    return rest
  }),
  updateAgreementDraftForEntity: vi.fn(),
}))

import { clientsAgreementsStaffRoute } from '../agreements-staff'
import {
  createAgreementDraftForEntity,
  discardAgreementDraftForEntity,
  sendAgreementPaymentPortalForEntity,
  sendAgreementDraftForEntity,
  updateAgreementDraftForEntity,
  voidAgreementForEntity,
} from '../../../services/agreements/agreement-service'

const ADMIN_USER = {
  id: 'clerk_admin_1',
  staffId: 'staff_admin_1',
  email: 'admin@test.com',
  name: 'Admin User',
  role: 'ADMIN',
  organizationId: 'org_1',
  clerkOrgId: 'org_clerk_1',
  orgRole: 'org:admin',
} satisfies AuthUser

const clientId = 'cabcdefghij1234567890aaaa'
const agreementId = 'cabcdefghij1234567890bbbb'
const expectedUpdatedAt = '2026-06-25T10:00:00.000Z'
const pricingInput = {
  nec1099Count: 1,
  payrollEmployees: 0,
  payrollMode: 'owner-manual',
  cashPlan: { enabled: false, employees: 0, owners: 0 },
  auditProtection: false,
  oneTime: {
    startLlc: 0,
    holdingLlcNew: 0,
    holdingLlcModify: 0,
    personalTaxReturn: 0,
    businessTaxReturn: 0,
  },
  salesTaxShops: 0,
  customItems: [],
  rates: {
    tiers: { basicMonthly: 50000, proMonthly: 75000, vipMonthly: 100000 },
    payroll: { baseMonthly: 15000 },
    cashPlan: { setup: 50000, perEmployeeMonthly: 10000, perOwnerMonthly: 5000 },
    auditProtection: { monthly: 10000, setup: 5000 },
    oneTime: {
      startLlc: 50000,
      holdingLlcNew: 75000,
      holdingLlcModify: 50000,
      personalTaxReturn: 25000,
      businessTaxReturnFederal: 35000,
      businessTaxReturnState: 20000,
    },
    salesTaxMonitoringMonthly: 5000,
  },
} as const

function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', ADMIN_USER)
    await next()
  })
  app.route('/clients', clientsAgreementsStaffRoute)
  return app
}

function draft(overrides: Record<string, unknown> = {}) {
  return {
    id: agreementId,
    token: 'tok_should_not_leave_route',
    status: 'DRAFT',
    ...overrides,
  }
}

function jsonRequest(path: string, method: string, body: unknown) {
  return buildApp().request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('client agreement draft staff routes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passes client draft creates to the shared draft service without exposing token', async () => {
    vi.mocked(createAgreementDraftForEntity).mockResolvedValueOnce(draft() as never)

    const res = await jsonRequest(`/clients/${clientId}/agreements/drafts`, 'POST', {
      type: 'ENGAGEMENT_LETTER',
      contentHtml: '<p>Scope</p>',
      source: 'CALCULATOR',
      sourceSnapshot: { quoteId: 'quote_1' },
      calculatorQuote: { pricingInput, paymentPortalMode: 'STAFF_REVIEW' },
    })
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.data.token).toBeUndefined()
    expect(createAgreementDraftForEntity).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'client',
      entityId: clientId,
      orgId: 'org_1',
      staffId: 'staff_admin_1',
      type: 'ENGAGEMENT_LETTER',
      source: 'CALCULATOR',
      sourceSnapshot: { quoteId: 'quote_1' },
      calculatorQuote: { pricingInput, paymentPortalMode: 'STAFF_REVIEW' },
    }))
  })

  it('passes client draft updates with expectedUpdatedAt to the shared draft service', async () => {
    vi.mocked(updateAgreementDraftForEntity).mockResolvedValueOnce(draft() as never)

    const res = await jsonRequest(
      `/clients/${clientId}/agreements/${agreementId}/draft`,
      'PATCH',
      {
        expectedUpdatedAt,
        type: 'ENGAGEMENT_LETTER',
        contentHtml: '<p>Updated</p>',
        source: 'CALCULATOR',
        calculatorQuote: { pricingInput, paymentPortalMode: 'AUTO_SEND' },
      },
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.token).toBeUndefined()
    expect(updateAgreementDraftForEntity).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'client',
      entityId: clientId,
      agreementId,
      orgId: 'org_1',
      staffId: 'staff_admin_1',
      expectedUpdatedAt,
      contentHtml: '<p>Updated</p>',
      source: 'CALCULATOR',
      calculatorQuote: { pricingInput, paymentPortalMode: 'AUTO_SEND' },
    }))
  })

  it('passes client draft sends to the guarded draft-send service without exposing token', async () => {
    vi.mocked(sendAgreementDraftForEntity).mockResolvedValueOnce({
      agreement: draft({ status: 'SENT' }),
      url: 'https://portal.test/agreements/tok_123',
    } as never)

    const res = await jsonRequest(
      `/clients/${clientId}/agreements/${agreementId}/send`,
      'POST',
      {
        expectedUpdatedAt,
        type: 'ENGAGEMENT_LETTER',
        contentHtml: '<p>Final</p>',
        paymentPortalMode: 'STAFF_REVIEW',
      },
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.url).toBe('https://portal.test/agreements/tok_123')
    expect(json.data.token).toBeUndefined()
    expect(sendAgreementDraftForEntity).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'client',
      entityId: clientId,
      agreementId,
      orgId: 'org_1',
      staffId: 'staff_admin_1',
      expectedUpdatedAt,
      contentHtml: '<p>Final</p>',
      paymentPortalMode: 'STAFF_REVIEW',
    }))
  })

  it('activates a signed client calculator payment portal without exposing the raw token', async () => {
    vi.mocked(sendAgreementPaymentPortalForEntity).mockResolvedValueOnce({
      quoteId: 'quote_1',
      payToken: 'tok_hidden',
      payUrl: 'https://portal.test/quote/tok_hidden',
      smsSent: true,
    } as never)

    const res = await buildApp().request(
      `/clients/${clientId}/agreements/${agreementId}/send-payment-portal`,
      { method: 'POST' },
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({
      quoteId: 'quote_1',
      payUrl: 'https://portal.test/quote/tok_hidden',
      smsSent: true,
    })
    expect(json.payToken).toBeUndefined()
    expect(sendAgreementPaymentPortalForEntity).toHaveBeenCalledWith({
      entityType: 'client',
      entityId: clientId,
      agreementId,
      orgId: 'org_1',
      staffId: 'staff_admin_1',
    })
  })

  it('passes client draft discards with freshness metadata', async () => {
    vi.mocked(discardAgreementDraftForEntity).mockResolvedValueOnce({
      id: agreementId,
      status: 'DISCARDED',
    })

    const res = await jsonRequest(
      `/clients/${clientId}/agreements/${agreementId}/draft`,
      'DELETE',
      { expectedUpdatedAt },
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toEqual({ id: agreementId, status: 'DISCARDED' })
    expect(discardAgreementDraftForEntity).toHaveBeenCalledWith({
      entityType: 'client',
      entityId: clientId,
      agreementId,
      orgId: 'org_1',
      expectedUpdatedAt,
    })
  })

  it('passes client void requests to the shared void service', async () => {
    vi.mocked(voidAgreementForEntity).mockResolvedValueOnce(
      draft({
        status: 'VOIDED',
        voidReason: 'Sent wrong agreement',
        voidedByUserId: 'staff_admin_1',
      }) as never,
    )

    const res = await jsonRequest(
      `/clients/${clientId}/agreements/${agreementId}/void`,
      'POST',
      { reason: 'Sent wrong agreement' },
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.token).toBeUndefined()
    expect(json.data.status).toBe('VOIDED')
    expect(voidAgreementForEntity).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'client',
      entityId: clientId,
      agreementId,
      orgId: 'org_1',
      staffId: 'staff_admin_1',
      reason: 'Sent wrong agreement',
    }))
  })
})
