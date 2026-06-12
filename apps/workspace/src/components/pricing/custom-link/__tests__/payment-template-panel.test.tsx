import { renderToStaticMarkup } from 'react-dom/server'
import type React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentTemplatePanel } from '../templates/payment-template-panel'
import type { CustomItemDraft } from '../custom-link-types'

const testState = vi.hoisted(() => ({
  createTemplate: vi.fn(),
  capturedSave: undefined as
    | undefined
    | ((input: { name: string; description?: string }) => Promise<void>),
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
  Select: ({
    options,
    placeholder,
    ...props
  }: React.SelectHTMLAttributes<HTMLSelectElement> & {
    options: Array<{ value: string; label: string }>
    placeholder?: string
  }) => (
    <select {...props}>
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}))

vi.mock('../templates/payment-template-save-modal', () => ({
  PaymentTemplateSaveModal: ({
    open,
    onSave,
  }: {
    open: boolean
    onSave: (input: { name: string; description?: string }) => Promise<void>
  }) => {
    testState.capturedSave = onSave
    return open ? <div>Save payment template</div> : null
  },
}))

vi.mock('../templates/use-payment-templates', () => ({
  usePaymentTemplates: () => ({
    templates: [
      {
        id: 'tpl_1',
        name: 'Monthly bookkeeping',
        description: 'Standard monthly setup',
        template: {
          billingInterval: 'month',
          items: [{ label: 'Bookkeeping', unitAmountCents: 30000, quantity: 1 }],
        },
        itemCount: 1,
        totalCents: 30000,
        createdAt: '2026-06-12T00:00:00.000Z',
        updatedAt: '2026-06-12T00:00:00.000Z',
      },
    ],
    loading: false,
    error: null,
  }),
  useCreatePaymentTemplate: () => ({
    isPending: false,
    mutateAsync: testState.createTemplate,
  }),
}))

const validItems: CustomItemDraft[] = [
  {
    id: 'draft-1',
    label: 'Setup',
    description: '',
    amount: '100',
    quantity: '1',
    billingInterval: 'one_time',
  },
]

describe('PaymentTemplatePanel', () => {
  beforeEach(() => {
    testState.createTemplate.mockReset()
    testState.capturedSave = undefined
  })

  it('renders saved templates and save action', () => {
    const markup = renderToStaticMarkup(
      <PaymentTemplatePanel items={validItems} disabledReason={null} onLoadTemplate={vi.fn()} />
    )

    expect(markup).toContain('Payment templates')
    expect(markup).toContain('Monthly bookkeeping (1 item)')
    expect(markup).toContain('Load')
    expect(markup).toContain('Save as template')
  })

  it('disables save when rows are invalid', () => {
    const markup = renderToStaticMarkup(
      <PaymentTemplatePanel
        items={[{ ...validItems[0], label: '' }]}
        disabledReason="Fix or remove the incomplete item rows."
        onLoadTemplate={vi.fn()}
      />
    )

    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>.*Save as template/s)
    expect(markup).toContain('Fix or remove the incomplete item rows.')
  })

  it('saves templates with line items only', async () => {
    testState.createTemplate.mockResolvedValue({ id: 'tpl_new' })
    renderToStaticMarkup(
      <PaymentTemplatePanel items={validItems} disabledReason={null} onLoadTemplate={vi.fn()} />
    )

    await testState.capturedSave?.({ name: 'Setup package', description: 'Use for new clients' })

    expect(testState.createTemplate).toHaveBeenCalledWith({
      name: 'Setup package',
      description: 'Use for new clients',
      template: {
        billingInterval: 'one_time',
        items: [{ label: 'Setup', unitAmountCents: 10000, quantity: 1 }],
      },
    })
    expect(testState.createTemplate.mock.calls[0][0].template).not.toHaveProperty('couponId')
    expect(testState.createTemplate.mock.calls[0][0].template).not.toHaveProperty(
      'allowPromotionCodes'
    )
  })
})
