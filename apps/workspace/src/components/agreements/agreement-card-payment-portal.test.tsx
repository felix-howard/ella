import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Agreement, AgreementPaymentPortalSendResult } from '../../lib/api-client'
import { NdaCard } from './agreement-card'

const mocks = vi.hoisted(() => ({
  mutationData: undefined as AgreementPaymentPortalSendResult | undefined,
  sendMutate: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, values?: Record<string, unknown>) => {
      if (key === 'agreements.metadata.actorWithTime') {
        return `${values?.name}, ${values?.time}`
      }
      return key
    },
  }),
}))

vi.mock('@ella/ui', () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' '),
}))

vi.mock('../../lib/clipboard', () => ({
  copyToClipboard: vi.fn(),
}))

vi.mock('../../lib/formatters', () => ({
  formatFullDateTime: (value: string) => `full:${value}`,
  formatShortRelativeTime: (value: string) => `relative:${value}`,
}))

vi.mock('../../stores/toast-store', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock('./agreement-extend-modal', () => ({
  AgreementExtendModal: () => null,
}))

vi.mock('./agreement-draft-card', () => ({
  AgreementDraftCard: () => null,
}))

vi.mock('./agreement-void-modal', () => ({
  AgreementVoidModal: () => null,
}))

vi.mock('./resend-payment-link-button', () => ({
  ResendPaymentLinkButton: () => null,
}))

vi.mock('./use-agreement-mutations', () => ({
  agreementsApi: () => ({
    getPdfUrl: vi.fn(),
  }),
  useResendAgreement: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
}))

vi.mock('./use-send-agreement-payment-portal', () => ({
  useSendAgreementPaymentPortal: () => ({
    data: mocks.mutationData,
    isPending: false,
    mutate: mocks.sendMutate,
  }),
}))

const entity = { type: 'client' as const, id: 'client_1' }

function agreement(overrides: Partial<Agreement> = {}): Agreement {
  return {
    id: 'agreement_1',
    type: 'NDA',
    title: 'Test agreement',
    internalNote: null,
    source: 'MANUAL',
    sourceSnapshot: null,
    paymentQuoteId: null,
    paymentPortalMode: 'NONE',
    paymentQuote: null,
    leadId: null,
    clientId: 'client_1',
    organizationId: 'org_1',
    templateId: null,
    templateVersion: 'v1',
    customContentHtml: '<p>Agreement</p>',
    status: 'SIGNED',
    depositStatus: null,
    depositAmount: null,
    depositPaidAt: null,
    depositResolvedAt: null,
    depositNote: null,
    url: undefined,
    expiresAt: '2026-07-01T00:00:00.000Z',
    expiryDays: 30,
    isActive: true,
    lastUsedAt: null,
    usageCount: 0,
    signedAt: '2026-06-28T12:00:00.000Z',
    signerName: 'Client One',
    signerEmail: 'client@example.test',
    signedPdfKey: null,
    consentTaxpayerName: null,
    consentBusinessName: null,
    consentTinLastFour: null,
    createdByUserId: 'staff_1',
    lastEditedByUserId: null,
    sentByUserId: 'staff_1',
    voidedAt: null,
    voidedByUserId: null,
    voidedBy: null,
    voidReason: null,
    createdBy: { id: 'staff_1', name: 'Ada Staff', email: 'ada@example.test' },
    lastEditedBy: null,
    sentBy: { id: 'staff_1', name: 'Ada Staff', email: 'ada@example.test' },
    createdAt: '2026-06-28T00:00:00.000Z',
    updatedAt: '2026-06-28T00:00:00.000Z',
    ...overrides,
  }
}

function calculatorAgreement(overrides: Partial<Agreement> = {}): Agreement {
  return agreement({
    type: 'ENGAGEMENT_LETTER',
    title: 'Engagement Letter',
    source: 'CALCULATOR',
    paymentQuoteId: 'quote_1',
    paymentPortalMode: 'STAFF_REVIEW',
    paymentQuote: {
      id: 'quote_1',
      status: 'agreement_signed_review',
      payUrl: null,
      sentAt: null,
      monthlyTotalCents: 25000,
      setupTotalCents: 50000,
    },
    ...overrides,
  })
}

describe('NdaCard calculator payment portal action', () => {
  beforeEach(() => {
    mocks.mutationData = undefined
    mocks.sendMutate.mockReset()
  })

  it('shows pending review badge and send action for signed staff-review calculator quotes', () => {
    const markup = renderToStaticMarkup(<NdaCard entity={entity} nda={calculatorAgreement()} />)

    expect(markup).toContain('agreements.paymentPortal.badge.pending_review')
    expect(markup).toContain('agreements.paymentPortal.sendAction')
    expect(markup).not.toContain('agreements.paymentPortal.copyAction')
  })

  it('shows copy action when the calculator quote already has a pay URL', () => {
    const markup = renderToStaticMarkup(
      <NdaCard
        entity={entity}
        nda={calculatorAgreement({
          paymentQuote: {
            id: 'quote_1',
            status: 'sent',
            payUrl: 'https://portal.test/quote/tok_pay',
            sentAt: '2026-06-29T12:00:00.000Z',
            monthlyTotalCents: 25000,
            setupTotalCents: 50000,
          },
        })}
      />,
    )

    expect(markup).toContain('agreements.paymentPortal.badge.sent')
    expect(markup).toContain('agreements.paymentPortal.copyAction')
    expect(markup).not.toContain('agreements.paymentPortal.sendAction')
  })

  it('retrieves an existing sent staff-review quote link through the authorized action', () => {
    const markup = renderToStaticMarkup(
      <NdaCard
        entity={entity}
        nda={calculatorAgreement({
          paymentQuote: {
            id: 'quote_1',
            status: 'sent',
            payUrl: null,
            sentAt: '2026-06-29T12:00:00.000Z',
            monthlyTotalCents: 25000,
            setupTotalCents: 50000,
          },
        })}
      />,
    )

    expect(markup).toContain('agreements.paymentPortal.badge.sent')
    expect(markup).toContain('agreements.paymentPortal.getLinkAction')
    expect(markup).not.toContain('agreements.paymentPortal.copyAction')
  })

  it('does not show a copy or get-link action for auto-sent quotes without an authorized URL', () => {
    const markup = renderToStaticMarkup(
      <NdaCard
        entity={entity}
        nda={calculatorAgreement({
          paymentPortalMode: 'AUTO_SEND',
          paymentQuote: {
            id: 'quote_1',
            status: 'sent',
            payUrl: null,
            sentAt: '2026-06-29T12:00:00.000Z',
            monthlyTotalCents: 25000,
            setupTotalCents: 50000,
          },
        })}
      />,
    )

    expect(markup).toContain('agreements.paymentPortal.badge.sent')
    expect(markup).not.toContain('agreements.paymentPortal.getLinkAction')
    expect(markup).not.toContain('agreements.paymentPortal.copyAction')
  })

  it('shows copy fallback after an in-session send response returns a pay URL', () => {
    mocks.mutationData = {
      quoteId: 'quote_1',
      payUrl: 'https://portal.test/quote/tok_pay',
      smsSent: false,
      smsSkippedReason: 'no_phone',
    }

    const markup = renderToStaticMarkup(<NdaCard entity={entity} nda={calculatorAgreement()} />)

    expect(markup).toContain('agreements.paymentPortal.copyAction')
    expect(markup).not.toContain('agreements.paymentPortal.sendAction')
  })

  it('shows paid badge without payment portal actions for active quotes', () => {
    const markup = renderToStaticMarkup(
      <NdaCard
        entity={entity}
        nda={calculatorAgreement({
          paymentQuote: {
            id: 'quote_1',
            status: 'active',
            payUrl: 'https://portal.test/quote/tok_pay',
            sentAt: '2026-06-29T12:00:00.000Z',
            monthlyTotalCents: 25000,
            setupTotalCents: 50000,
          },
        })}
      />,
    )

    expect(markup).toContain('agreements.paymentPortal.badge.paid')
    expect(markup).not.toContain('agreements.paymentPortal.sendAction')
    expect(markup).not.toContain('agreements.paymentPortal.copyAction')
  })

  it('hides automation UI for manual, legacy calculator, and non-signed agreements', () => {
    const manualMarkup = renderToStaticMarkup(<NdaCard entity={entity} nda={agreement()} />)
    const legacyMarkup = renderToStaticMarkup(
      <NdaCard entity={entity} nda={calculatorAgreement({ paymentQuoteId: null, paymentQuote: null })} />,
    )
    const sentMarkup = renderToStaticMarkup(
      <NdaCard entity={entity} nda={calculatorAgreement({ status: 'SENT', signedAt: null })} />,
    )

    expect(manualMarkup).not.toContain('agreements.paymentPortal')
    expect(legacyMarkup).not.toContain('agreements.paymentPortal')
    expect(sentMarkup).not.toContain('agreements.paymentPortal')
  })
})
