import { renderToStaticMarkup } from 'react-dom/server'
import type React from 'react'
import { describe, expect, it, vi } from 'vitest'
import type {
  ClientPayment,
  ClientPaymentsResponse,
  ClientQuotePayment,
} from '../../../lib/api-client'
import { ClientPaymentsTab } from './client-payments-tab'

const testState = vi.hoisted(() => ({
  query: {
    isLoading: false,
    isError: false,
    data: { success: true, pastDue: false, data: [] as ClientPayment[] } as ClientPaymentsResponse,
  },
}))

const reconcileState = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
  variables: undefined as string | undefined,
}))

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
  useTranslation: () => ({
    t: (key: string, values?: { method?: string }) => {
      if (key === 'payments.paymentMethod') return `Paid with ${values?.method ?? ''}`
      const labels: Record<string, string> = {
        'payments.tabTitle': 'Payments',
        'payments.copyPayLink': 'Copy pay link',
        'payments.payLinkCopied': 'Pay link copied',
        'payments.receiptAction': 'Receipt',
        'payments.receiptPending': 'Receipt pending',
        'payments.refreshReceipt': 'Refresh receipt',
        'payments.refreshingReceipt': 'Refreshing',
        'payments.refreshReceiptAria': 'Refresh payment receipt from Stripe',
        'payments.openReceiptAria': 'Open payment receipt in a new tab',
        'payments.requestedOn': 'Requested',
        'payments.paidOn': 'Paid',
        'payments.copyRetryLink': 'Copy retry link',
        'payments.quoteSectionTitle': 'Payment quotes',
        'payments.ledgerSectionTitle': 'Collected payments',
        'payments.quoteSentOn': 'Sent',
        'payments.quoteRecurringAmount': `Then ${values?.method ?? ''}`,
        'payments.billingInterval.month': 'month',
        'payments.quoteSource.custom': 'Custom quote',
        'payments.quoteSource.calculator': 'Calculator quote',
        'payments.stripeSession': `Stripe session ${values?.method ?? ''}`,
        'payments.bankProcessingTitle': 'Bank payment processing',
        'payments.bankProcessingDesc': 'Do not send another payment link while ACH settlement is pending.',
        'payments.duplicateReviewTitle': 'Duplicate payment needs review',
        'payments.duplicateReviewDesc': 'A second successful settlement was detected.',
        'payments.quoteBankProcessingDesc': 'ACH bank payment submitted.',
        'payments.quoteDuplicateDesc': 'Duplicate settlement detected.',
        'payments.type.DEPOSIT': 'Initial payment',
        'payments.status.PENDING': 'Pending',
        'payments.status.PAID': 'Paid',
        'payments.quoteStatus.processing_bank_payment': 'Bank processing',
        'payments.quoteStatus.payment_failed_retryable': 'Failed - retryable',
        'payments.quoteStatus.duplicate_paid_review': 'Duplicate review',
      }
      return labels[key] ?? key
    },
  }),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <a className={className} href="/clients/client_1">
      {children}
    </a>
  ),
}))

vi.mock('@ella/ui', () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
}))

vi.mock('../../../lib/clipboard', () => ({
  copyToClipboard: vi.fn(),
}))

vi.mock('./use-client-payments', () => ({
  useClientPayments: () => testState.query,
}))

vi.mock('./use-reconcile-payment-receipt', () => ({
  useReconcilePaymentReceipt: () => reconcileState,
}))

function buildPayment(overrides: Partial<ClientPayment>): ClientPayment {
  return {
    id: 'pay_1',
    type: 'DEPOSIT',
    status: 'PAID',
    amount: '500.00',
    currency: 'usd',
    description: 'Initial payment',
    paidAt: '2026-06-08T10:00:00.000Z',
    createdAt: '2026-06-07T10:00:00.000Z',
    agreement: null,
    payUrl: 'http://portal.test/pay/tok_abc',
    stripeCustomerId: null,
    stripeInvoiceId: null,
    stripeChargeId: null,
    receiptUrl: null,
    invoicePdfUrl: null,
    hostedInvoiceUrl: null,
    receiptNumber: null,
    paymentMethodLabel: null,
    receiptSyncedAt: null,
    receiptStatus: 'not_applicable',
    ...overrides,
  }
}

function buildQuotePayment(overrides: Partial<ClientQuotePayment>): ClientQuotePayment {
  return {
    id: 'quote_1',
    source: 'custom',
    rawStatus: 'awaiting_payment',
    state: 'processing_bank_payment',
    amount: '700.00',
    recurringAmount: '0.00',
    currency: 'usd',
    billingInterval: null,
    sentAt: '2026-06-07T10:00:00.000Z',
    createdAt: '2026-06-07T10:00:00.000Z',
    lastStripeEventAt: '2026-06-07T10:01:00.000Z',
    paidAt: null,
    agreement: null,
    payUrl: 'http://portal.test/quote/tok_quote',
    mayStartCheckout: false,
    latestStripeSessionId: 'cs_test',
    latestStripePaymentIntentId: null,
    latestStripeInvoiceId: null,
    staleProcessing: false,
    ...overrides,
  }
}

describe('ClientPaymentsTab', () => {
  it('renders a safe receipt link and payment method for paid rows', () => {
    testState.query = {
      isLoading: false,
      isError: false,
      data: {
        success: true,
        pastDue: false,
        data: [
          buildPayment({
            hostedInvoiceUrl: 'https://invoice.stripe.com/i/in_123',
            invoicePdfUrl: 'https://invoice.stripe.com/i/in_123.pdf',
            receiptUrl: 'https://pay.stripe.com/receipts/ch_123',
            paymentMethodLabel: 'Visa •••• 4242',
            receiptStatus: 'available',
            receiptSyncedAt: '2026-06-08T10:01:00.000Z',
          }),
        ],
      },
    }

    const markup = renderToStaticMarkup(<ClientPaymentsTab clientId="client_1" />)

    expect(markup).toContain('Receipt')
    expect(markup).toContain('href="https://invoice.stripe.com/i/in_123"')
    expect(markup).toContain('target="_blank"')
    expect(markup).toContain('rel="noopener noreferrer"')
    expect(markup).toContain('aria-label="Open payment receipt in a new tab"')
    expect(markup).toContain('Paid with Visa')
  })

  it('shows refresh receipt action for paid rows missing receipt artifacts', () => {
    testState.query = {
      isLoading: false,
      isError: false,
      data: {
        success: true,
        pastDue: false,
        data: [buildPayment({ receiptStatus: 'pending' })],
      },
    }

    const markup = renderToStaticMarkup(<ClientPaymentsTab clientId="client_1" />)

    expect(markup).toContain('Refresh receipt')
    expect(markup).toContain('aria-label="Refresh payment receipt from Stripe"')
    expect(markup).not.toContain('href="https://invoice.stripe.com')
  })

  it('does not render blank or unsafe receipt URLs', () => {
    testState.query = {
      isLoading: false,
      isError: false,
      data: {
        success: true,
        pastDue: false,
        data: [
          buildPayment({
            hostedInvoiceUrl: 'javascript:alert(1)',
            invoicePdfUrl: '   ',
            receiptUrl: 'http://pay.stripe.com/receipts/ch_123',
            receiptStatus: 'available',
          }),
        ],
      },
    }

    const markup = renderToStaticMarkup(<ClientPaymentsTab clientId="client_1" />)

    expect(markup).not.toContain('javascript:')
    expect(markup).not.toContain('http://pay.stripe.com/receipts/ch_123')
    expect(markup).not.toContain('href=')
  })

  it('keeps pending rows focused on copy pay link', () => {
    testState.query = {
      isLoading: false,
      isError: false,
      data: {
        success: true,
        pastDue: false,
        data: [
          buildPayment({
            status: 'PENDING',
            paidAt: null,
            receiptStatus: 'not_applicable',
          }),
        ],
      },
    }

    const markup = renderToStaticMarkup(<ClientPaymentsTab clientId="client_1" />)

    expect(markup).toContain('Copy pay link')
    expect(markup).not.toContain('Refresh receipt')
  })

  it('shows bank-processing quote monitoring without a copy action', () => {
    testState.query = {
      isLoading: false,
      isError: false,
      data: {
        success: true,
        pastDue: false,
        data: [],
        quotePayments: [buildQuotePayment({ state: 'processing_bank_payment' })],
        monitoring: {
          bankProcessingCount: 1,
          staleBankProcessingCount: 0,
          duplicateReviewCount: 0,
          paymentFailedCount: 0,
          subscriptionCanceledAfterPaymentCount: 0,
        },
      },
    }

    const markup = renderToStaticMarkup(<ClientPaymentsTab clientId="client_1" />)

    expect(markup).toContain('Bank payment processing')
    expect(markup).toContain('Bank processing')
    expect(markup).toContain('ACH bank payment submitted.')
    expect(markup).not.toContain('Copy pay link')
    expect(markup).not.toContain('Copy retry link')
  })

  it('shows duplicate review quote monitoring without a copy action', () => {
    testState.query = {
      isLoading: false,
      isError: false,
      data: {
        success: true,
        pastDue: false,
        data: [],
        quotePayments: [
          buildQuotePayment({
            state: 'duplicate_paid_review',
            rawStatus: 'active',
            source: 'calculator',
            mayStartCheckout: false,
          }),
        ],
        monitoring: {
          bankProcessingCount: 0,
          staleBankProcessingCount: 0,
          duplicateReviewCount: 1,
          paymentFailedCount: 0,
          subscriptionCanceledAfterPaymentCount: 0,
        },
      },
    }

    const markup = renderToStaticMarkup(<ClientPaymentsTab clientId="client_1" />)

    expect(markup).toContain('Duplicate payment needs review')
    expect(markup).toContain('Duplicate review')
    expect(markup).toContain('Duplicate settlement detected.')
    expect(markup).not.toContain('Copy pay link')
  })

  it('allows retry-link copy for retryable failed quotes', () => {
    testState.query = {
      isLoading: false,
      isError: false,
      data: {
        success: true,
        pastDue: false,
        data: [],
        quotePayments: [
          buildQuotePayment({
            state: 'payment_failed_retryable',
            rawStatus: 'payment_failed',
            mayStartCheckout: true,
          }),
        ],
        monitoring: {
          bankProcessingCount: 0,
          staleBankProcessingCount: 0,
          duplicateReviewCount: 0,
          paymentFailedCount: 1,
          subscriptionCanceledAfterPaymentCount: 0,
        },
      },
    }

    const markup = renderToStaticMarkup(<ClientPaymentsTab clientId="client_1" />)

    expect(markup).toContain('Failed - retryable')
    expect(markup).toContain('Copy retry link')
  })
})
