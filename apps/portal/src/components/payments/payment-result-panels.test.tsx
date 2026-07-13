import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { PaymentBankProcessingPanel, PaymentPaidPanel } from './payment-result-panels'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, options?: { amount?: string; orgName?: string }) => {
      if (options?.amount || options?.orgName) {
        return `${key}:${options.amount ?? ''}:${options.orgName ?? ''}`
      }
      return key
    },
  }),
}))

vi.mock('@ella/ui', () => ({
  Button: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}))

describe('payment result panels', () => {
  it('renders ACH bank processing copy without a payment CTA', () => {
    const markup = renderToStaticMarkup(
      <PaymentBankProcessingPanel refreshing={false} onRefresh={() => undefined} />
    )

    expect(markup).toContain('pay.bankProcessing.title')
    expect(markup).toContain('pay.bankProcessing.doNotPayAgain')
    expect(markup).toContain('pay.bankProcessing.refresh')
    expect(markup).not.toContain('pay.payButton')
  })

  it('uses subscription-canceled-after-payment copy for paid subscriptions that later end', () => {
    const markup = renderToStaticMarkup(
      <PaymentPaidPanel
        orgName="Ella Tax"
        amountFormatted="$250.00"
        paidAt="2026-07-12T12:00:00.000Z"
        variant="subscriptionCanceledAfterPayment"
      />
    )

    expect(markup).toContain('pay.subscriptionCanceledAfterPayment.title')
    expect(markup).toContain('pay.subscriptionCanceledAfterPayment.message:$250.00:Ella Tax')
    expect(markup).not.toContain('pay.error.canceled.message')
  })
})
