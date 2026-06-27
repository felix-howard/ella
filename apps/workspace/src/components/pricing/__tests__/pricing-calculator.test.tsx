import { renderToStaticMarkup } from 'react-dom/server'
import type React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_CALCULATOR_CUSTOM_ITEM_AMOUNT,
  calculatePricing,
  createDefaultPricingInput,
  decodePricingQuote,
} from '@ella/shared/pricing'
import type { PricingCalculatorInput } from '@ella/shared/pricing'
import { PricingCalculatorForm } from '../pricing-calculator-form'
import { PricingCalculatorPage } from '../pricing-calculator-page'
import {
  buildPricingPrintMessage,
  buildPricingPrintUrl,
  PricingPrintPanel,
} from '../pricing-print-panel'
import { PricingSummaryPanel } from '../pricing-summary-panel'
import {
  getPricingCalculatorCustomAmountDraftError,
  toPricingCalculatorCustomDraftNumber,
} from '../pricing-calculator-custom-items'
import { PricingCalculatorCustomItemRow } from '../pricing-calculator-custom-item-row'
import { getCreateDisabledReason, getPrintDisabledReason } from '../pricing-disabled-reasons'

const useMutationMock = vi.hoisted(() => vi.fn())
const createCheckoutSessionMock = vi.hoisted(() => vi.fn())
const sendQuoteMock = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-query', () => ({
  useMutation: (options: unknown) => useMutationMock(options),
  // Send-quote panel's recipient search; no results during static render.
  useQuery: () => ({ data: undefined, isFetching: false }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}))

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ orgId: 'org_test' }),
}))

vi.mock('../../../lib/api-client', () => ({
  api: {
    billing: {
      createCheckoutSession: createCheckoutSessionMock,
      sendQuote: sendQuoteMock,
    },
    recipients: {
      search: vi.fn(),
    },
  },
}))

vi.mock('../../../stores/toast-store', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock('../../../lib/clipboard', () => ({
  copyToClipboard: vi.fn(),
}))

vi.mock('@ella/ui', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
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
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  SelectField: ({
    label,
    options,
    ...props
  }: React.SelectHTMLAttributes<HTMLSelectElement> & {
    label: string
    options: Array<{ value: string; label: string }>
  }) => (
    <label>
      {label}
      <select {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  ),
  Select: ({
    options,
    ...props
  }: React.SelectHTMLAttributes<HTMLSelectElement> & {
    options?: Array<{ value: string; label: string }>
  }) => (
    <select {...props}>
      {options?.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  Switch: ({
    checked,
    onCheckedChange: _onCheckedChange,
    ...props
  }: {
    checked: boolean
    onCheckedChange?: (checked: boolean) => void
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button aria-pressed={checked} {...props} />
  ),
}))

describe('workspace pricing calculator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useMutationMock.mockImplementation((options) => ({
      error: null,
      isPending: false,
      mutateAsync: vi.fn(options.mutationFn),
    }))
  })

  it('renders calculator sections and disables checkout before a billable selection', () => {
    const markup = renderToStaticMarkup(<PricingCalculatorPage />)

    expect(markup).toContain('Pricing Calculator')
    expect(markup).toContain('Monthly services')
    expect(markup).toContain('Quote summary')
    expect(markup).toContain('Quote PDF')
    expect(markup).toContain('Print PDF')
    expect(markup).toContain('Payment link')
    expect(markup).toContain('Send to client')
    expect(markup).toContain('Engagement letter')
    expect(markup).toContain('Prepare engagement letter')
    expect(markup.indexOf('engagement-letter-panel-title')).toBeLessThan(markup.indexOf('payment-link-title'))
    expect(markup.indexOf('payment-link-title')).toBeLessThan(markup.indexOf('send-quote-title'))
    expect(markup.indexOf('send-quote-title')).toBeLessThan(markup.indexOf('quote-pdf-title'))
    expect(markup).toContain('Custom items')
    expect(markup).toContain('Add item')
    expect(markup).toContain('Select at least one billable service')
    expect(markup).toContain('button')
    expect(markup).toContain('disabled=""')
    expect(markup).not.toContain('Bearer token')
  })

  it('renders updated totals when quantities change', () => {
    const input = createDefaultPricingInput()
    input.nec1099Count = 11
    input.payrollEmployees = 5
    input.cashPlan = { enabled: true, employees: 5, owners: 1 }

    const markup = renderToStaticMarkup(<PricingSummaryPanel result={calculatePricing(input)} />)

    expect(markup).toContain('Monthly bookkeeping service')
    expect(markup).toContain('Payroll employees')
    expect(markup).toContain('Cash Plan')
    expect(markup).toContain('$245')
    expect(markup).toContain('$1,400')
  })

  it('renders quantity fields as text inputs so browser scrolling cannot step values', () => {
    const input = createDefaultPricingInput()
    input.cashPlan.enabled = true
    const markup = renderToStaticMarkup(
      <PricingCalculatorForm input={input} onInputChange={vi.fn()} />
    )
    const quantityInputIds = [
      'pricing-nec-count',
      'pricing-payroll-employees',
      'pricing-cash-employees',
      'pricing-cash-owners',
      'pricing-sales-tax-shops',
    ]

    for (const id of quantityInputIds) {
      const inputMarkup = markup.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))?.[0] ?? ''
      expect(inputMarkup).toContain('type="text"')
      expect(inputMarkup).toContain('inputMode="numeric"')
      expect(inputMarkup).toContain('pattern="[0-9]*"')
    }
    expect(markup).toContain('value=""')
    expect(markup).toContain('[appearance:textfield]')
    expect(markup).toContain('[&amp;::-webkit-inner-spin-button]:appearance-none')
    expect(markup).not.toContain('type="number"')
  })

  it('renders editable rate fields with zero as the minimum instead of default prices', () => {
    const input = createDefaultPricingInput()
    input.cashPlan.enabled = true
    input.auditProtection = true

    const markup = renderToStaticMarkup(
      <PricingCalculatorForm input={input} onInputChange={vi.fn()} />
    )

    expect(markup).toContain('aria-label="0-10 workers / mo rate"')
    expect(markup).toContain('aria-label="Setup rate"')
    expect(markup).toContain('aria-label="Audit / mo rate"')
    // Money fields render formatted (e.g. "$1,000") for clarity.
    expect(markup).toContain('value="$75"')
    expect(markup).toContain('value="$1,000"')
    expect(markup).toContain('value="$300"')
    expect(markup).not.toContain('min="75"')
    expect(markup).not.toContain('min="1000"')
    expect(markup).not.toContain('min="300"')
  })

  it('hides Cash Plan and Audit Detection custom fields until their toggles are enabled', () => {
    const input = createDefaultPricingInput()

    const disabledMarkup = renderToStaticMarkup(
      <PricingCalculatorForm input={input} onInputChange={vi.fn()} />
    )

    expect(disabledMarkup).toContain('Enable Cash Plan')
    expect(disabledMarkup).toContain('Enable Audit Detection')
    expect(disabledMarkup).not.toContain('Employees enrolled')
    expect(disabledMarkup).not.toContain('Owners / shareholders')
    expect(disabledMarkup).not.toContain('Per employee / mo')
    expect(disabledMarkup).not.toContain('Audit / mo')
    expect(disabledMarkup).not.toContain('Audit setup')

    input.cashPlan.enabled = true
    input.auditProtection = true

    const enabledMarkup = renderToStaticMarkup(
      <PricingCalculatorForm input={input} onInputChange={vi.fn()} />
    )

    expect(enabledMarkup).toContain('Employees enrolled')
    expect(enabledMarkup).toContain('Owners / shareholders')
    expect(enabledMarkup).toContain('Per employee / mo')
    expect(enabledMarkup).toContain('Audit / mo')
    expect(enabledMarkup).toContain('Audit setup')
  })

  it('hides one-time service fields until one-time services are enabled', () => {
    const input = createDefaultPricingInput()

    const disabledMarkup = renderToStaticMarkup(
      <PricingCalculatorForm input={input} onInputChange={vi.fn()} />
    )

    expect(disabledMarkup).toContain('Enable one-time services')
    expect(disabledMarkup).not.toContain('Start LLC')
    expect(disabledMarkup).not.toContain('Business tax return pre-pay (1 tax year)')
    expect(disabledMarkup).not.toContain('aria-label="Federal rate"')

    input.oneTime.personalTaxReturn = 1

    const enabledMarkup = renderToStaticMarkup(
      <PricingCalculatorForm input={input} onInputChange={vi.fn()} />
    )

    expect(enabledMarkup).toContain('Start LLC')
    expect(enabledMarkup).toContain('Personal tax return')
    expect(enabledMarkup).not.toContain('Business tax return pre-pay (1 tax year)')
    expect(enabledMarkup).not.toContain('aria-label="Federal rate"')
    expect(enabledMarkup).not.toContain('value="$800"')
  })

  it('renders calculator custom item rows without yearly billing', () => {
    const input = createDefaultPricingInput()
    input.customItems = [
      {
        id: 'custom-item-a',
        label: 'Cleanup review',
        amount: 250,
        quantity: 2,
        billingInterval: 'month',
      },
    ]

    const markup = renderToStaticMarkup(
      <PricingCalculatorForm input={input} onInputChange={vi.fn()} />
    )

    expect(markup).toContain('Cleanup review')
    expect(markup).toContain('Monthly')
    expect(markup).toContain('Line total $500/mo')
    expect(markup).toContain('Use Custom link for yearly recurring or custom-only charges.')
    expect(markup).not.toContain('>Yearly<')
  })

  it('shows validation for partially filled calculator custom items', () => {
    const input = createDefaultPricingInput()
    input.customItems = [
      {
        id: 'custom-item-b',
        label: '',
        amount: 125,
        quantity: 1,
        billingInterval: 'one_time',
      },
    ]

    const markup = renderToStaticMarkup(
      <PricingCalculatorForm input={input} onInputChange={vi.fn()} />
    )

    expect(markup).toContain('Enter an item name.')
    expect(markup).not.toContain('Line total $125 one-time')
  })

  it('does not show validation for newly added untouched custom item rows', () => {
    const markup = renderToStaticMarkup(
      <PricingCalculatorCustomItemRow
        item={{
          id: 'custom-item-new',
          label: '',
          amount: 0,
          quantity: 1,
          billingInterval: 'one_time',
        }}
        index={0}
        disabled={false}
        showValidation={false}
        onInteract={vi.fn()}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
      />
    )

    expect(markup).not.toContain('Enter an item name.')
    expect(markup).not.toContain('Enter an amount of at least $1.')
    expect(markup).not.toContain('aria-invalid="true"')
  })

  it('keeps invalid calculator custom item amount drafts out of pricing numbers', () => {
    expect(getPricingCalculatorCustomAmountDraftError('0')).toBe('Enter an amount of at least $1.')
    expect(getPricingCalculatorCustomAmountDraftError('-')).toBe('Enter a whole-dollar amount.')
    expect(getPricingCalculatorCustomAmountDraftError('1000000')).toBe(
      'Amount must be 999,999 or less.'
    )
    expect(toPricingCalculatorCustomDraftNumber('-', MAX_CALCULATOR_CUSTOM_ITEM_AMOUNT)).toBe(0)
  })

  it('shows custom item fix copy instead of generic quantity copy for print quote', () => {
    const input = createDefaultPricingInput()
    input.nec1099Count = 1
    input.customItems = [
      {
        id: 'custom-item-c',
        label: '',
        amount: 125,
        quantity: 1,
        billingInterval: 'one_time',
      },
    ]

    const markup = renderToStaticMarkup(
      <PricingPrintPanel input={input} result={calculatePricing(input)} />
    )

    expect(markup).toContain('Finish or remove incomplete custom item rows.')
    expect(markup).not.toContain('Quantity limits exceeded. Reduce quantities before checkout.')
  })

  it('shows custom item fix copy before selection copy for payment links', () => {
    const input = createDefaultPricingInput()
    input.customItems = [
      {
        id: 'custom-item-d',
        label: '',
        amount: 125,
        quantity: 1,
        billingInterval: 'one_time',
      },
    ]

    expect(getCreateDisabledReason(input, calculatePricing(input))).toBe(
      'Finish or remove incomplete custom item rows.'
    )
  })

  it('points custom-only calculator quotes to Custom link', () => {
    const input = createDefaultPricingInput()
    input.customItems = [
      {
        id: 'custom-item-only',
        label: 'Advisory cleanup',
        amount: 300,
        quantity: 1,
        billingInterval: 'one_time',
      },
    ]
    const result = calculatePricing(input)
    const reason =
      'Use Custom link for custom-only charges, or select a standard calculator service.'

    expect(getCreateDisabledReason(input, result)).toBe(reason)
    expect(getPrintDisabledReason(input, result)).toBe(reason)
  })

  it('renders custom monthly and one-time rows in quote summary totals', () => {
    const input = createDefaultPricingInput()
    input.nec1099Count = 1
    input.customItems = [
      {
        id: 'custom-monthly',
        label: 'Advisory add-on',
        amount: 40,
        quantity: 2,
        billingInterval: 'month',
      },
      {
        id: 'custom-once',
        label: 'Clean-up project',
        amount: 120,
        quantity: 1,
        billingInterval: 'one_time',
      },
    ]
    const result = calculatePricing(input)

    const markup = renderToStaticMarkup(<PricingSummaryPanel result={result} />)

    expect(markup).toContain('Advisory add-on × 2')
    expect(markup).toContain('Clean-up project')
    expect(result.monthlyTotal + result.setupTotal).toBe(425)
    expect(result.monthlyTotal).toBe(155)
    expect(result.setupDisplayTotal).toBe(270)
    expect(markup).toContain('$425')
    expect(markup).toContain('$155')
    expect(markup).toContain('$270')
  })

  it('allows small-range print quotes', () => {
    const input = createDefaultPricingInput()
    input.nec1099Count = 1

    expect(getPrintDisabledReason(input, calculatePricing(input))).toBeNull()
  })

  it('allows 21+ worker payment links, send-to-client, print quotes, and custom monthly rates', () => {
    const input = createDefaultPricingInput()
    input.nec1099Count = 25
    input.rates.tiers.vipMonthly = 65
    const result = calculatePricing(input)
    const markup = renderToStaticMarkup(<PricingSummaryPanel result={result} />)

    expect(result.tier).toBe('vip')
    expect(result.tierLabel).toBe('21+ workers')
    expect(result.monthlyTotal).toBe(65)
    expect(getCreateDisabledReason(input, result)).toBeNull()
    expect(getPrintDisabledReason(input, result)).toBeNull()
    expect(markup).toContain('Monthly bookkeeping service')
    expect(markup).toContain('$65')
    expect(markup).not.toContain('manual follow-up')
    expect(markup).not.toContain('cannot create checkout links')
  })

  it('keeps custom item labels out of the print quote URL', () => {
    const input = createDefaultPricingInput()
    input.nec1099Count = 1
    input.customItems = [
      {
        id: 'custom-print-private',
        label: 'Sensitive client cleanup',
        amount: 125,
        quantity: 1,
        billingInterval: 'one_time',
      },
    ]

    const url = buildPricingPrintUrl()
    const message = buildPricingPrintMessage(input)

    expect(url).toContain('/pricing/print')
    expect(url).not.toContain('?q=')
    expect(url).not.toContain('Sensitive client cleanup')
    expect(decodePricingQuote(message.quote)?.input.customItems).toEqual(input.customItems)
  })

  it('renders zero-valued rate fields as empty so typing does not keep a leading zero', () => {
    const input = createDefaultPricingInput()
    input.rates.tiers.proMonthly = 0

    const markup = renderToStaticMarkup(
      <PricingCalculatorForm input={input} onInputChange={vi.fn()} />
    )

    expect(markup).toContain('aria-label="11-20 workers / mo rate"')
    expect(markup).toContain('value=""')
    expect(markup).not.toContain('value="0"')
  })

  it('builds an anonymous checkout-session payload without token or customer fields', async () => {
    renderToStaticMarkup(<PricingCalculatorPage />)
    const mutationOptions = useMutationMock.mock.calls[0][0] as {
      mutationFn: (payload: { pricingInput: PricingCalculatorInput }) => Promise<unknown>
    }
    const pricingInput = createDefaultPricingInput()
    pricingInput.nec1099Count = 1
    pricingInput.customItems = [
      {
        id: 'custom-checkout',
        label: 'Checkout add-on',
        amount: 200,
        quantity: 1,
        billingInterval: 'one_time',
      },
    ]

    await mutationOptions.mutationFn({ pricingInput })

    expect(createCheckoutSessionMock).toHaveBeenCalledWith({ pricingInput })
    expect(createCheckoutSessionMock.mock.calls[0][0].pricingInput.customItems).toEqual(
      pricingInput.customItems
    )
    expect(createCheckoutSessionMock.mock.calls[0][0]).not.toHaveProperty('bearerToken')
    expect(createCheckoutSessionMock.mock.calls[0][0]).not.toHaveProperty('token')
    expect(createCheckoutSessionMock.mock.calls[0][0]).not.toHaveProperty('customerEmail')
    expect(createCheckoutSessionMock.mock.calls[0][0]).not.toHaveProperty('customerName')
    expect(createCheckoutSessionMock.mock.calls[0][0]).not.toHaveProperty('businessName')
  })

  it('keeps custom items in the send-to-client mutation payload', async () => {
    renderToStaticMarkup(<PricingCalculatorPage />)
    const sendMutationOptions = useMutationMock.mock.calls[1][0] as {
      mutationFn: (payload: {
        pricingInput: PricingCalculatorInput
        recipient: { type: 'lead'; id: string }
      }) => Promise<unknown>
    }
    const pricingInput = createDefaultPricingInput()
    pricingInput.nec1099Count = 1
    pricingInput.customItems = [
      {
        id: 'custom-send',
        label: 'Sent quote add-on',
        amount: 90,
        quantity: 3,
        billingInterval: 'month',
      },
    ]
    const payload = {
      pricingInput,
      recipient: { type: 'lead' as const, id: 'lead_1' },
    }

    await sendMutationOptions.mutationFn(payload)

    expect(sendQuoteMock).toHaveBeenCalledWith(payload)
    expect(sendQuoteMock.mock.calls[0][0].pricingInput.customItems).toEqual(
      pricingInput.customItems
    )
  })
})
