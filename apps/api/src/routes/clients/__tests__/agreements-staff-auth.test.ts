/**
 * Regression tests for client agreement staff route auth scoping.
 * Admin-only agreement endpoints must not block unrelated /clients routes.
 */
import { describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../middleware/auth'

vi.mock('../../../services/agreements/agreement-service', () => ({
  createAgreementForEntity: vi.fn(),
  getDefaultHtmlForEntity: vi.fn(),
  updateDepositForEntity: vi.fn(),
  getPresignedPdfUrlForEntity: vi.fn(),
  resendAgreementForEntity: vi.fn(),
  extendAgreementForEntity: vi.fn(),
  renderPreviewPdf: vi.fn(),
}))

import { clientsAgreementsStaffRoute } from '../agreements-staff'

function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', {
      id: 'clerk_member_1',
      staffId: 'staff_member_1',
      email: 'member@test.com',
      name: 'Member User',
      role: 'STAFF',
      organizationId: 'org_1',
      clerkOrgId: 'org_clerk_1',
      orgRole: 'org:member',
    })
    await next()
  })
  app.route('/clients', clientsAgreementsStaffRoute)
  app.get('/clients', (c) => c.json({ ok: true }))
  return app
}

describe('clients agreement staff auth scope', () => {
  it('does not apply org-admin guard to unrelated client list route', async () => {
    const res = await buildApp().request('/clients')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ ok: true })
  })

  it('still requires org-admin for client agreement mutations', async () => {
    const res = await buildApp().request('/clients/cabcdefghij1234567890aaaa/agreements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(403)
  })
})
