import {
  MAX_CALCULATOR_CUSTOM_ITEMS,
  type PricingCalculatorCustomItem,
} from '@ella/shared/pricing'
import { Button } from '@ella/ui'
import { Plus, ReceiptText } from 'lucide-react'
import { useState } from 'react'
import { PricingCalculatorCustomItemRow } from './pricing-calculator-custom-item-row'
import { createPricingCalculatorCustomItem } from './pricing-calculator-custom-items'

interface PricingCalculatorCustomItemsSectionProps {
  items: PricingCalculatorCustomItem[]
  disabled?: boolean
  onChange: (items: PricingCalculatorCustomItem[]) => void
}

export function PricingCalculatorCustomItemsSection({
  items,
  disabled = false,
  onChange,
}: PricingCalculatorCustomItemsSectionProps) {
  const [deferredValidationItemIds, setDeferredValidationItemIds] = useState<Set<string>>(
    () => new Set()
  )

  const markItemInteracted = (id: string) => {
    setDeferredValidationItemIds((current) => {
      if (!current.has(id)) return current
      const next = new Set(current)
      next.delete(id)
      return next
    })
  }

  const updateItem = (id: string, patch: Partial<PricingCalculatorCustomItem>) => {
    markItemInteracted(id)
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const removeItem = (id: string) => {
    setDeferredValidationItemIds((current) => {
      if (!current.has(id)) return current
      const next = new Set(current)
      next.delete(id)
      return next
    })
    onChange(items.filter((item) => item.id !== id))
  }

  const addItem = () => {
    if (items.length >= MAX_CALCULATOR_CUSTOM_ITEMS) return
    const item = createPricingCalculatorCustomItem()
    setDeferredValidationItemIds((current) => new Set(current).add(item.id))
    onChange([...items, item])
  }

  return (
    <section
      className="space-y-4 rounded-lg border border-border bg-card p-4"
      aria-labelledby="pricing-custom-items-title"
    >
      <header>
        <h2
          id="pricing-custom-items-title"
          className="flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          <ReceiptText className="h-4 w-4 text-primary" />
          Custom items
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Use Custom link for yearly recurring or custom-only charges.
        </p>
      </header>

      {items.length > 0 && (
        <ul className="space-y-3">
          {items.map((item, index) => (
            <PricingCalculatorCustomItemRow
              key={item.id}
              item={item}
              index={index}
              disabled={disabled}
              showValidation={!deferredValidationItemIds.has(item.id)}
              onInteract={() => markItemInteracted(item.id)}
              onUpdate={(patch) => updateItem(item.id, patch)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={addItem}
        disabled={disabled || items.length >= MAX_CALCULATOR_CUSTOM_ITEMS}
      >
        <Plus className="h-4 w-4" />
        Add item
      </Button>
    </section>
  )
}
