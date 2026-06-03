import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  organizationFindFirstMock,
  staffFindFirstMock,
  clientFindFirstMock,
  txClientCreateMock,
  txClientUpdateManyMock,
  txClientManagerDeleteManyMock,
  txClientManagerCreateManyMock,
  txTaxCaseCreateMock,
  txConversationCreateMock,
  transactionMock,
} = vi.hoisted(() => ({
  organizationFindFirstMock: vi.fn(),
  staffFindFirstMock: vi.fn(),
  clientFindFirstMock: vi.fn(),
  txClientCreateMock: vi.fn(),
  txClientUpdateManyMock: vi.fn(),
  txClientManagerDeleteManyMock: vi.fn(),
  txClientManagerCreateManyMock: vi.fn(),
  txTaxCaseCreateMock: vi.fn(),
  txConversationCreateMock: vi.fn(),
  transactionMock: vi.fn(),
}))

vi.mock('../../../lib/db', () => ({
  prisma: {
    organization: { findFirst: organizationFindFirstMock },
    staff: { findFirst: staffFindFirstMock },
    client: { findFirst: clientFindFirstMock },
    $transaction: transactionMock,
  },
}))

vi.mock('../../../services/engagement-helpers', () => ({
  findOrCreateEngagement: vi.fn().mockResolvedValue({ engagementId: 'eng_1' }),
}))

vi.mock('../../../services/magic-link', () => ({
  createMagicLink: vi.fn().mockResolvedValue('https://portal.test/upload/token'),
}))

vi.mock('../../../services/sms', () => ({
  isSmsEnabled: vi.fn().mockReturnValue(true),
  sendWelcomeMessage: vi.fn().mockResolvedValue({ smsSent: true, messageId: 'msg_1' }),
}))

vi.mock('../../../services/crypto', () => ({
  encryptSSN: vi.fn((value: string) => `encrypted:${value}`),
}))

vi.mock('../../../middleware/rate-limiter', () => ({
  rateLimiter: () => async (_c: unknown, next: () => Promise<void>) => next(),
}))

import { Hono } from 'hono'
import { sendWelcomeMessage } from '../../../services/sms'
import { formRoute } from '../index'

function buildApp() {
  const app = new Hono()
  app.route('/form', formRoute)
  return app
}

function validIndividualBody(staffSlug?: string) {
  return {
    clientType: 'INDIVIDUAL',
    firstName: 'Tuyet',
    lastName: 'Nguyen',
    phone: '+14155550101',
    email: 'tuyet@example.com',
    taxYear: 2025,
    language: 'EN',
    ...(staffSlug ? { staffSlug } : {}),
  }
}

beforeEach(() => {
  vi.clearAllMocks()

  clientFindFirstMock.mockResolvedValue(null)
  txClientCreateMock.mockResolvedValue({ id: 'client_1' })
  txClientUpdateManyMock.mockResolvedValue({ count: 1 })
  txClientManagerDeleteManyMock.mockResolvedValue({ count: 0 })
  txClientManagerCreateManyMock.mockResolvedValue({ count: 1 })
  txTaxCaseCreateMock.mockResolvedValue({ id: 'case_1' })
  txConversationCreateMock.mockResolvedValue({ id: 'conv_1' })
  transactionMock.mockImplementation((cb: (tx: unknown) => unknown) => cb({
    client: { create: txClientCreateMock, updateMany: txClientUpdateManyMock },
    clientManager: {
      deleteMany: txClientManagerDeleteManyMock,
      createMany: txClientManagerCreateManyMock,
    },
    taxCase: { create: txTaxCaseCreateMock },
    conversation: { create: txConversationCreateMock },
  }))
})

describe('POST /form/:orgSlug/submit upload-link template defaults', () => {
  it('preserves existing SMS fallback when no org or staff template is configured', async () => {
    organizationFindFirstMock.mockResolvedValue({
      id: 'org_1',
      autoSendFormClientUploadLink: true,
      defaultUploadLinkTemplateId: null,
    })

    const res = await buildApp().request('/form/ella-tax/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validIndividualBody()),
    })

    expect(res.status).toBe(200)
    expect(sendWelcomeMessage).toHaveBeenCalledWith(
      'case_1',
      'Tuyet Nguyen',
      '+14155550101',
      'https://portal.test/upload/token',
      2025,
      'EN',
      undefined,
      null
    )
  })

  it('uses the org default template for generic form auto-send', async () => {
    organizationFindFirstMock.mockResolvedValue({
      id: 'org_1',
      autoSendFormClientUploadLink: true,
      defaultUploadLinkTemplateId: 'tax-documents',
    })

    const res = await buildApp().request('/form/ella-tax/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validIndividualBody()),
    })

    expect(res.status).toBe(200)
    const customMessage = vi.mocked(sendWelcomeMessage).mock.calls[0][6]
    expect(customMessage).toContain('{{tax_year}} tax documents')
  })

  it('uses staff default before org default for staff-routed form auto-send', async () => {
    organizationFindFirstMock.mockResolvedValue({
      id: 'org_1',
      autoSendFormClientUploadLink: true,
      defaultUploadLinkTemplateId: 'tax-documents',
    })
    staffFindFirstMock.mockResolvedValue({
      id: 'staff_1',
      autoSendUploadLink: true,
      defaultUploadLinkTemplateId: 'official-channel',
    })

    const res = await buildApp().request('/form/ella-tax/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validIndividualBody('staff-a')),
    })

    expect(res.status).toBe(200)
    const customMessage = vi.mocked(sendWelcomeMessage).mock.calls[0][6]
    expect(customMessage).toContain('official communication channel')
    expect(vi.mocked(sendWelcomeMessage).mock.calls[0][7]).toBe('staff_1')
  })
})
