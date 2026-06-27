import { renderToStaticMarkup } from 'react-dom/server'
import type React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CustomLinkActions } from '../custom-link-actions'
import type { CustomLinkCorePayload } from '../custom-link-types'

const mutationState = vi.hoisted(() => ({
  createLink: vi.fn(),
  sendQuote: vi.fn(),
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
  Combobox: ({ placeholder }: { placeholder?: string }) => <input placeholder={placeholder} />,
}))

vi.mock('../../use-recipient-search', () => ({
  useRecipientSearch: () => ({ items: [], loading: false }),
  decodeRecipientId: vi.fn(),
}))

vi.mock('../use-custom-link', () => ({
  useCreateCustomLink: () => ({
    isPending: false,
    error: null,
    data: null,
    mutateAsync: mutationState.createLink,
    reset: vi.fn(),
  }),
  useSendCustomQuote: () => ({
    isPending: false,
    error: null,
    data: null,
    mutateAsync: mutationState.sendQuote,
    reset: vi.fn(),
  }),
}))

vi.mock('../custom-link-result', () => ({
  CustomLinkCreateResult: () => <div>Created link</div>,
  CustomLinkSendResult: () => <div>Sent quote</div>,
}))

vi.mock('../../../../stores/toast-store', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

const corePayload: CustomLinkCorePayload = {
  billingInterval: 'one_time',
  items: [{ label: 'Setup', unitAmountCents: 10000, quantity: 1 }],
}

describe('CustomLinkActions', () => {
  it('marks direct Stripe URL creation as anonymous', () => {
    const markup = renderToStaticMarkup(
      <CustomLinkActions corePayload={corePayload} disabledReason={null} />
    )

    expect(markup).toContain('Create anonymous Stripe URL')
    expect(markup).toContain('Not attached to a client profile.')
    expect(markup).toContain('Send Payment Link')
  })
})
