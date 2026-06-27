import { renderToStaticMarkup } from 'react-dom/server'
import type React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { calculatePricing, createDefaultPricingInput } from '@ella/shared/pricing'
import {
  createCalculatorEngagementLetterModalState,
  getEngagementLetterDisabledReason,
  type SelectedRecipient,
} from '../pricing-engagement-letter-panel-helpers'
import {
  PricingEngagementLetterPanel,
} from '../pricing-engagement-letter-panel'

vi.mock('../use-recipient-search', () => ({
  decodeRecipientId: (value: string) => {
    const [type, id] = value.split(':')
    return type === 'client' || type === 'lead' ? { type, id } : null
  },
  useRecipientSearch: () => ({
    items: [],
    recipientByItemId: new Map(),
    loading: false,
  }),
}))

vi.mock('@ella/ui', () => ({
  Combobox: ({ query, placeholder }: { query: string; placeholder?: string }) => (
    <input value={query} placeholder={placeholder} readOnly />
  ),
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
}))

describe('PricingEngagementLetterPanel', () => {
  it('renders the calculator engagement letter action disabled until a recipient is selected', () => {
    const input = createDefaultPricingInput()
    input.nec1099Count = 1

    const markup = renderToStaticMarkup(
      <PricingEngagementLetterPanel
        pricingInput={input}
        pricingResult={calculatePricing(input)}
        disabledReason={null}
      />,
    )

    expect(markup).toContain('Engagement letter')
    expect(markup).toContain('Prepare engagement letter')
    expect(markup).toContain('Search clients or leads')
    expect(markup).toContain('Select a client or lead to prepare an engagement letter.')
    expect(markup).toContain('disabled=""')
  })

  it('prioritizes calculator invalid states over recipient states', () => {
    const selected = {
      item: { id: 'lead:lead_1', label: 'Ada Lovelace' },
      metadata: {
        id: 'lead_1',
        type: 'lead' as const,
        label: 'Ada Lovelace',
        hasPhone: true,
      },
    }

    expect(
      getEngagementLetterDisabledReason('Payable total must be greater than $0.', selected),
    ).toBe('Payable total must be greater than $0.')
  })

  it('blocks selected recipients that cannot receive the agreement SMS', () => {
    const selected = {
      item: { id: 'client:client_1', label: 'No Phone' },
      metadata: {
        id: 'client_1',
        type: 'client' as const,
        label: 'No Phone',
        hasPhone: false,
      },
    }

    expect(getEngagementLetterDisabledReason(null, selected)).toBe(
      'Selected recipient has no phone on file. Add a phone number before sending.',
    )
  })

  it('maps selected recipient and calculator quote into modal state', () => {
    const input = createDefaultPricingInput()
    input.payrollEmployees = 3
    const selected: SelectedRecipient = {
      item: { id: 'client:client_1', label: 'Ada Lovelace', hint: 'ACME · •••• 1234' },
      metadata: {
        id: 'client_1',
        type: 'client',
        label: 'Ada Lovelace',
        hint: 'ACME · •••• 1234',
        hasPhone: true,
      },
    }

    const modalState = createCalculatorEngagementLetterModalState(
      selected,
      input,
      calculatePricing(input),
    )

    expect(modalState.entity).toEqual({ type: 'client', id: 'client_1' })
    expect(modalState.recipientLabel).toBe('Ada Lovelace')
    expect(modalState.recipientHint).toBe('ACME · •••• 1234')
    expect(modalState.draftSeed.contentHtml).toContain('<h2>Engagement Letter</h2>')
    expect(modalState.draftSeed.contentHtml).toContain('Payroll employees (3 × $7, owner-manual): $21.')
    expect(modalState.draftSeed.contentHtml).toContain('Tax Filing Allocation (Months 1-6 Only)')
    expect(modalState.draftSeed.source).toBe('CALCULATOR')
    expect(modalState.draftSeed.sourceSnapshot).toMatchObject({
      recipient: { type: 'client', id: 'client_1' },
      setupTotal: expect.any(Number),
      monthlyTotal: expect.any(Number),
      tierLabel: expect.any(String),
    })
    expect(modalState.draftSeed.sourceSnapshot).not.toHaveProperty('pricingInput')
    expect(modalState.draftSeed.sourceSnapshot).not.toHaveProperty('pricingResult')
  })
})
