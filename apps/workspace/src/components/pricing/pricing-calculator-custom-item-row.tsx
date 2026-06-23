import {
  MAX_CALCULATOR_CUSTOM_ITEM_AMOUNT,
  MAX_CALCULATOR_CUSTOM_ITEM_QUANTITY,
  MAX_CALCULATOR_CUSTOM_LABEL_LENGTH,
  type PricingCalculatorCustomBillingInterval,
  type PricingCalculatorCustomItem,
} from '@ella/shared/pricing'
import { Input, Select } from '@ella/ui'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { formatCurrency } from './pricing-format'
import {
  CALCULATOR_CUSTOM_BILLING_OPTIONS,
  getPricingCalculatorCustomAmountDraftError,
  getPricingCalculatorCustomItemLineTotal,
  getPricingCalculatorCustomItemValidation,
  getPricingCalculatorCustomQuantityDraftError,
  toPricingCalculatorCustomDraftNumber,
} from './pricing-calculator-custom-items'

interface PricingCalculatorCustomItemRowProps {
  item: PricingCalculatorCustomItem
  index: number
  disabled: boolean
  onUpdate: (patch: Partial<PricingCalculatorCustomItem>) => void
  onRemove: () => void
}

const numberInputClass =
  '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'

export function PricingCalculatorCustomItemRow({
  item,
  index,
  disabled,
  onUpdate,
  onRemove,
}: PricingCalculatorCustomItemRowProps) {
  const [amountDraft, setAmountDraft] = useState(() => formatDraftNumber(item.amount))
  const [quantityDraft, setQuantityDraft] = useState(() => formatDraftNumber(item.quantity))
  const draft = { amountDraft, quantityDraft }
  const validationMessages = getPricingCalculatorCustomItemValidation(item, draft)
  const hasValidation = validationMessages.length > 0
  const lineTotal = getPricingCalculatorCustomItemLineTotal(item, draft)
  const nameInvalid =
    hasValidation &&
    (item.label.trim().length === 0 ||
      item.label.trim().length > MAX_CALCULATOR_CUSTOM_LABEL_LENGTH)
  const amountInvalid =
    hasValidation && getPricingCalculatorCustomAmountDraftError(amountDraft) !== null
  const quantityInvalid =
    hasValidation && getPricingCalculatorCustomQuantityDraftError(quantityDraft) !== null
  const nameId = `${item.id}-name`
  const amountId = `${item.id}-amount`
  const billingId = `${item.id}-billing`
  const quantityId = `${item.id}-quantity`
  const errorId = `${item.id}-error`

  return (
    <li className="rounded-lg border border-border/70 bg-background p-3">
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_8rem_8rem_5rem_2.75rem]">
        <label htmlFor={nameId} className="block text-xs font-medium text-foreground">
          Item name
          <Input
            id={nameId}
            value={item.label}
            disabled={disabled}
            onChange={(event) => onUpdate({ label: event.target.value })}
            className="mt-1"
            placeholder="Bookkeeping cleanup"
            maxLength={MAX_CALCULATOR_CUSTOM_LABEL_LENGTH}
            aria-label={`Custom item ${index + 1} name`}
            aria-invalid={nameInvalid}
            aria-describedby={hasValidation ? errorId : undefined}
          />
        </label>

        <label htmlFor={amountId} className="block text-xs font-medium text-foreground">
          Amount ($)
          <Input
            id={amountId}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={amountDraft}
            disabled={disabled}
            onChange={(event) => {
              const nextValue = event.target.value
              setAmountDraft(nextValue)
              onUpdate({
                amount: toPricingCalculatorCustomDraftNumber(
                  nextValue,
                  MAX_CALCULATOR_CUSTOM_ITEM_AMOUNT
                ),
              })
            }}
            className={`mt-1 ${numberInputClass}`}
            aria-invalid={amountInvalid}
            aria-describedby={hasValidation ? errorId : undefined}
          />
        </label>

        <label htmlFor={billingId} className="block text-xs font-medium text-foreground">
          Billing
          <Select
            id={billingId}
            value={item.billingInterval}
            disabled={disabled}
            onChange={(event) =>
              onUpdate({
                billingInterval: event.target.value as PricingCalculatorCustomBillingInterval,
              })
            }
            className="mt-1"
            options={CALCULATOR_CUSTOM_BILLING_OPTIONS}
            aria-label={`Custom item ${index + 1} billing interval`}
          />
        </label>

        <label htmlFor={quantityId} className="block text-xs font-medium text-foreground">
          Qty
          <Input
            id={quantityId}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={quantityDraft}
            disabled={disabled}
            onChange={(event) => {
              const nextValue = event.target.value
              setQuantityDraft(nextValue)
              onUpdate({
                quantity: toPricingCalculatorCustomDraftNumber(
                  nextValue,
                  MAX_CALCULATOR_CUSTOM_ITEM_QUANTITY
                ),
              })
            }}
            className={`mt-1 ${numberInputClass}`}
            aria-invalid={quantityInvalid}
            aria-describedby={hasValidation ? errorId : undefined}
          />
        </label>

        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          title={`Remove custom item ${index + 1}`}
          className="mt-5 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Remove custom item ${index + 1}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <p id={errorId} className="mt-2 min-h-4 text-[11px]" aria-live="polite">
        {hasValidation ? (
          <span className="text-error">{validationMessages.join(' ')}</span>
        ) : lineTotal !== null ? (
          <span className="text-muted-foreground">
            Line total {formatCurrency(lineTotal)}
            {item.billingInterval === 'month' ? '/mo' : ' one-time'}
          </span>
        ) : null}
      </p>
    </li>
  )
}

function formatDraftNumber(value: number): string {
  return value === 0 ? '' : String(value)
}
