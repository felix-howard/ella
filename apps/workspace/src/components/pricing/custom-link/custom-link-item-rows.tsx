import { Button, Input, Select } from '@ella/ui'
import { Plus, Trash2 } from 'lucide-react'
import {
  MAX_CUSTOM_ITEMS,
  createEmptyItem,
  dollarsToCents,
  formatCents,
  rowLineCents,
  type CustomItemDraft,
} from './custom-link-types'

const BILLING_OPTIONS = [
  { value: 'one_time', label: 'One-time' },
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
]

interface CustomLinkItemRowsProps {
  items: CustomItemDraft[]
  disabled: boolean
  onChange: (items: CustomItemDraft[]) => void
}

export function CustomLinkItemRows({ items, disabled, onChange }: CustomLinkItemRowsProps) {
  const updateItem = (id: string, patch: Partial<CustomItemDraft>) => {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id))
  }

  const addItem = () => {
    if (items.length >= MAX_CUSTOM_ITEMS) return
    onChange([...items, createEmptyItem()])
  }

  return (
    <section
      className="rounded-lg border border-border bg-card p-4"
      aria-labelledby="custom-items-title"
    >
      <header className="mb-3">
        <h2 id="custom-items-title" className="text-sm font-semibold text-foreground">
          Line items
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Add the services or products to charge for. Amounts are in US dollars.
        </p>
      </header>

      <ul className="space-y-3">
        {items.map((item, index) => {
          const amountInvalid =
            item.amount.trim().length > 0 && dollarsToCents(item.amount) === null
          const lineCents = rowLineCents(item)
          return (
            <li key={item.id} className="rounded-lg border border-border/70 bg-background p-3">
              <div className="flex items-start gap-2">
                <div className="grid flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_7rem] lg:grid-cols-[minmax(0,1fr)_8rem_7rem_4.5rem]">
                  <label className="block text-xs font-medium text-foreground sm:col-span-3 lg:col-span-4">
                    Item name
                    <textarea
                      value={item.label}
                      disabled={disabled}
                      onChange={(e) => updateItem(item.id, { label: e.target.value })}
                      className="mt-1 flex min-h-20 w-full resize-y rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm text-foreground transition-all duration-200 placeholder:text-muted-foreground/50 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder={'Bookkeeping\nAudit tax\nPaperwork cleanup'}
                      maxLength={120}
                      rows={3}
                      aria-label={`Item ${index + 1} name`}
                    />
                  </label>
                  <label className="block text-xs font-medium text-foreground sm:col-span-3 lg:col-span-4">
                    Description optional
                    <Input
                      value={item.description}
                      disabled={disabled}
                      onChange={(e) => updateItem(item.id, { description: e.target.value })}
                      className="mt-1"
                      placeholder="What this covers"
                      maxLength={500}
                      aria-label={`Item ${index + 1} description`}
                    />
                  </label>
                  <label className="block text-xs font-medium text-foreground">
                    Amount ($)
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={item.amount}
                      disabled={disabled}
                      onChange={(e) => updateItem(item.id, { amount: e.target.value })}
                      className="mt-1"
                      placeholder="0.00"
                      aria-invalid={amountInvalid}
                      aria-describedby={amountInvalid ? `${item.id}-amount-error` : undefined}
                      aria-label={`Item ${index + 1} amount in dollars`}
                    />
                  </label>
                  <label className="block text-xs font-medium text-foreground">
                    Billing
                    <Select
                      value={item.billingInterval}
                      disabled={disabled}
                      onChange={(e) =>
                        updateItem(item.id, {
                          billingInterval: e.target.value as CustomItemDraft['billingInterval'],
                        })
                      }
                      className="mt-1"
                      options={BILLING_OPTIONS}
                      aria-label={`Item ${index + 1} billing interval`}
                    />
                  </label>
                  <label className="block text-xs font-medium text-foreground">
                    Qty
                    <Input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      value={item.quantity}
                      disabled={disabled}
                      onChange={(e) => updateItem(item.id, { quantity: e.target.value })}
                      className="mt-1"
                      aria-label={`Item ${index + 1} quantity`}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  disabled={disabled || items.length <= 1}
                  className="mt-5 shrink-0 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                  aria-label={`Remove item ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 min-h-4 text-[11px]">
                {amountInvalid ? (
                  <span id={`${item.id}-amount-error`} className="text-error">
                    Enter a valid amount of at least $0.01.
                  </span>
                ) : lineCents !== null ? (
                  <span className="text-muted-foreground">Line total {formatCents(lineCents)}</span>
                ) : null}
              </p>
            </li>
          )
        })}
      </ul>

      <Button
        type="button"
        variant="outline"
        className="mt-3 w-full"
        onClick={addItem}
        disabled={disabled || items.length >= MAX_CUSTOM_ITEMS}
      >
        <Plus className="h-4 w-4" />
        Add item
      </Button>
    </section>
  )
}
