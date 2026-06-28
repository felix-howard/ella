// Regression tests for client agreement staff-route auth scoping.
import { describe, expect, it, vi } from 'vitest'
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

const MEMBER_USER = {
  id: 'clerk_member_1',
  staffId: 'staff_member_1',
  email: 'member@test.com',
  name: 'Member User',
  role: 'STAFF',
  organizationId: 'org_1',
  clerkOrgId: 'org_clerk_1',
  orgRole: 'org:member',
} satisfies AuthUser

function buildApp(user: AuthUser = MEMBER_USER) {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', user)
    await next()
  })
  app.route('/clients', clientsAgreementsStaffRoute)
  app.get('/clients', (c) => c.json({ ok: true }))
  return app
}

describe('clients agreement staff auth scope', () => {
  const clientId = 'cabcdefghij1234567890aaaa'

  it('does not apply org-admin guard to unrelated client list route', async () => {
    const res = await buildApp().request('/clients')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ ok: true })
  })

  it('still requires org-admin for client agreement mutations', async () => {
    const res = await buildApp().request(`/clients/${clientId}/agreements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(403)
  })
})
