import { renderToStaticMarkup } from 'react-dom/server'
import type React from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { ClientPayment } from '../../../lib/api-client'
import { ClientPaymentsTab } from './client-payments-tab'

const testState = vi.hoisted(() => ({
  query: {
    isLoading: false,
    isError: false,
    data: { pastDue: false, data: [] as ClientPayment[] },
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
        'payments.type.DEPOSIT': 'Initial payment',
        'payments.status.PENDING': 'Pending',
        'payments.status.PAID': 'Paid',
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

describe('ClientPaymentsTab', () => {
  it('renders a safe receipt link and payment method for paid rows', () => {
    testState.query = {
      isLoading: false,
      isError: false,
      data: {
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
})
