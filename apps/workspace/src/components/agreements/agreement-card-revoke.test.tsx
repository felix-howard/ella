import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { Agreement } from '../../lib/api-client'
import { NdaCard } from './agreement-card'

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
    status: 'SENT',
    depositStatus: null,
    depositAmount: null,
    depositPaidAt: null,
    depositResolvedAt: null,
    depositNote: null,
    url: 'https://portal.test/sign/abc',
    expiresAt: '2026-07-01T00:00:00.000Z',
    expiryDays: 30,
    isActive: true,
    lastUsedAt: null,
    usageCount: 0,
    signedAt: null,
    signerName: null,
    signerEmail: null,
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

describe('NdaCard revoke action', () => {
  it('shows revoke for sent and expired agreements', () => {
    const sentMarkup = renderToStaticMarkup(<NdaCard entity={entity} nda={agreement()} />)
    const expiredMarkup = renderToStaticMarkup(
      <NdaCard
        entity={entity}
        nda={agreement({ status: 'EXPIRED', isActive: false, url: undefined })}
      />,
    )

    expect(sentMarkup).toContain('nda.card.revoke')
    expect(expiredMarkup).toContain('nda.card.revoke')
  })

  it('hides link actions and shows audit metadata after revocation', () => {
    const markup = renderToStaticMarkup(
      <NdaCard
        entity={entity}
        nda={agreement({
          status: 'VOIDED',
          isActive: false,
          url: undefined,
          voidedAt: '2026-06-28T12:00:00.000Z',
          voidedByUserId: 'staff_2',
          voidedBy: { id: 'staff_2', name: 'Grace Staff', email: 'grace@example.test' },
          voidReason: 'Sent to the wrong client',
        })}
      />,
    )

    expect(markup).toContain('agreements.metadata.revoked')
    expect(markup).toContain('Grace Staff')
    expect(markup).toContain('agreements.metadata.revocationReason')
    expect(markup).toContain('Sent to the wrong client')
    expect(markup).not.toContain('nda.card.copyLink')
    expect(markup).not.toContain('nda.card.resend')
    expect(markup).not.toContain('nda.card.extend')
    expect(markup).not.toContain('nda.card.revoke')
  })

  it('does not show revoke for signed agreements', () => {
    const markup = renderToStaticMarkup(
      <NdaCard
        entity={entity}
        nda={agreement({
          status: 'SIGNED',
          signedAt: '2026-06-28T12:00:00.000Z',
          signedPdfKey: 'signed-pdfs/agreement.pdf',
        })}
      />,
    )

    expect(markup).not.toContain('nda.card.revoke')
  })
})
