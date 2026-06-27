import { renderToStaticMarkup } from 'react-dom/server'
import type React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PricingPaymentLinkPanel } from '../pricing-payment-link-panel'

vi.mock('../../../lib/clipboard', () => ({
  copyToClipboard: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'paymentLinks.createAnonymousStripeUrl': 'Create anonymous Stripe URL',
        'paymentLinks.anonymousClientHistoryWarning':
          'Not attached to a client profile. Use Send Payment Link to save payment history on the client ledger.',
      })[key] ?? key,
  }),
}))

vi.mock('@ella/ui', () => ({
  Button: ({
    children,
    disabled,
    onClick: _onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button disabled={disabled} {...props}>
      {children}
    </button>
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

describe('PricingPaymentLinkPanel', () => {
  it('renders a disabled state when the calculator input is not payable', () => {
    const markup = renderToStaticMarkup(
      <PricingPaymentLinkPanel
        checkout={null}
        disabledReason="Select at least one billable service before creating a link."
        errorMessage={null}
        isCreating={false}
        quoteChanged={false}
        onCreate={vi.fn()}
      />
    )

    expect(markup).toContain('Select at least one billable service before creating a link.')
    expect(markup).toContain('disabled=""')
  })

  it('renders anonymous payment-link creation without customer fields', () => {
    const markup = renderToStaticMarkup(
      <PricingPaymentLinkPanel
        checkout={null}
        disabledReason={null}
        errorMessage={null}
        isCreating={false}
        quoteChanged={false}
        onCreate={vi.fn()}
      />
    )

    expect(markup).toContain('Create anonymous Stripe URL')
    expect(markup).toContain('Not attached to a client profile.')
    expect(markup).not.toContain('Customer email optional')
    expect(markup).not.toContain('Customer name')
    expect(markup).not.toContain('Business')
  })

  it('renders created checkout URL actions', () => {
    const markup = renderToStaticMarkup(
      <PricingPaymentLinkPanel
        checkout={{
          checkoutUrl: 'https://checkout.stripe.test/session_123',
          quoteId: 'quote_123',
          sessionId: 'cs_test_123',
        }}
        disabledReason={null}
        errorMessage={null}
        isCreating={false}
        quoteChanged={false}
        onCreate={vi.fn()}
      />
    )

    expect(markup).toContain('quote_123')
    expect(markup).toContain('https://checkout.stripe.test/session_123')
    expect(markup).toContain('Copy')
    expect(markup).toContain('Open')
  })
})
