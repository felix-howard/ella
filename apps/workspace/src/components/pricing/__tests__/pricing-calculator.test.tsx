import { renderToStaticMarkup } from 'react-dom/server'
import type React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { calculatePricing, createDefaultPricingInput } from '@ella/shared/pricing'
import type { PricingCalculatorInput } from '@ella/shared/pricing'
import { PricingCalculatorForm } from '../pricing-calculator-form'
import { PricingCalculatorPage } from '../pricing-calculator-page'
import { PricingSummaryPanel } from '../pricing-summary-panel'

const useMutationMock = vi.hoisted(() => vi.fn())
const createCheckoutSessionMock = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-query', () => ({
  useMutation: (options: unknown) => useMutationMock(options),
}))

vi.mock('../../../lib/api-client', () => ({
  api: {
    billing: {
      createCheckoutSession: createCheckoutSessionMock,
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
    expect(markup).toContain('Payment link')
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

    expect(markup).toContain('Pro')
    expect(markup).toContain('Payroll employees')
    expect(markup).toContain('Cash Plan')
    expect(markup).toContain('$245')
    expect(markup).toContain('$1,400')
  })

  it('renders empty default quantity fields without browser number spinners', () => {
    const input = createDefaultPricingInput()
    const markup = renderToStaticMarkup(
      <PricingCalculatorForm input={input} defaults={input} onInputChange={vi.fn()} />
    )

    expect(markup).toContain('id="pricing-nec-count"')
    expect(markup).toContain('id="pricing-payroll-employees"')
    expect(markup).toContain('value=""')
    expect(markup).toContain('[appearance:textfield]')
    expect(markup).toContain('[&amp;::-webkit-inner-spin-button]:appearance-none')
  })

  it('builds the checkout-session payload from workspace fields without a token field', async () => {
    renderToStaticMarkup(<PricingCalculatorPage />)
    const mutationOptions = useMutationMock.mock.calls[0][0] as {
      mutationFn: (payload: {
        pricingInput: PricingCalculatorInput
        fields: { customerEmail: string; customerName: string; businessName: string }
      }) => Promise<unknown>
    }
    const pricingInput = createDefaultPricingInput()

    await mutationOptions.mutationFn({
      pricingInput,
      fields: {
        customerEmail: ' client@example.com ',
        customerName: ' Client One ',
        businessName: ' ',
      },
    })

    expect(createCheckoutSessionMock).toHaveBeenCalledWith({
      pricingInput,
      customerEmail: 'client@example.com',
      customerName: 'Client One',
      businessName: undefined,
    })
    expect(createCheckoutSessionMock.mock.calls[0][0]).not.toHaveProperty('bearerToken')
    expect(createCheckoutSessionMock.mock.calls[0][0]).not.toHaveProperty('token')
  })
})
