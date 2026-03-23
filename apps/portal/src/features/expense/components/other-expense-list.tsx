/**
 * OtherExpenseList Component
 * Dynamic add/delete rows for custom "Other" expenses
 * Each row: [expense name] + [amount] + [trash icon]
 * Max 20 items, names max 100 chars
 */
import { useCallback, useState, useEffect } from 'react'
import { Plus, Trash2, Package } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ella/ui'
import { useTranslation } from 'react-i18next'

export interface CustomExpenseItem {
  name: string
  amount: number | null
}

interface OtherExpenseListProps {
  items: CustomExpenseItem[]
  onChange: (items: CustomExpenseItem[]) => void
  disabled?: boolean
}

const MAX_ITEMS = 20

export function OtherExpenseList({ items, onChange, disabled }: OtherExpenseListProps) {
  const { t } = useTranslation()

  // Track raw string values so intermediate inputs like "123." or "123.20" are preserved
  const [rawAmounts, setRawAmounts] = useState<string[]>(() =>
    items.map((item) => (item.amount === null ? '' : String(item.amount)))
  )

  // Sync rawAmounts when items change externally (e.g. add/remove row)
  useEffect(() => {
    setRawAmounts((prev) => {
      if (prev.length === items.length) return prev
      return items.map((item, i) =>
        i < prev.length ? prev[i] : (item.amount === null ? '' : String(item.amount))
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length])

  const handleAddRow = useCallback(() => {
    if (items.length >= MAX_ITEMS) return
    setRawAmounts((prev) => [...prev, ''])
    onChange([...items, { name: '', amount: null }])
  }, [items, onChange])

  const handleRemoveRow = useCallback((index: number) => {
    setRawAmounts((prev) => prev.filter((_, i) => i !== index))
    onChange(items.filter((_, i) => i !== index))
  }, [items, onChange])

  const handleNameChange = useCallback((index: number, name: string) => {
    const updated = [...items]
    updated[index] = { ...updated[index], name }
    onChange(updated)
  }, [items, onChange])

  const handleAmountChange = useCallback((index: number, rawValue: string) => {
    // Allow empty or valid decimal input (up to 2 decimal places)
    if (rawValue !== '' && !/^\d*\.?\d{0,2}$/.test(rawValue)) return
    setRawAmounts((prev) => {
      const next = [...prev]
      next[index] = rawValue
      return next
    })
    const updated = [...items]
    const parsed = rawValue === '' ? null : parseFloat(rawValue)
    updated[index] = { ...updated[index], amount: isNaN(parsed as number) ? null : parsed }
    onChange(updated)
  }, [items, onChange])

  return (
    <Card variant="elevated">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Package className="w-4 h-4 text-primary" />
          </div>
          {t('expense.otherExpenses')}
        </CardTitle>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {t('expense.otherExpensesDescription')}
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            {/* Name input */}
            <input
              type="text"
              value={item.name}
              onChange={(e) => handleNameChange(index, e.target.value)}
              placeholder={t('expense.expenseName')}
              maxLength={100}
              disabled={disabled}
              className="flex-1 min-w-0 px-3.5 h-11 bg-card border border-border/60 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 focus:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-muted-foreground/50"
            />
            {/* Amount input with $ prefix */}
            <div className="relative w-32 flex-shrink-0">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/70 font-medium">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={rawAmounts[index] ?? ''}
                onChange={(e) => handleAmountChange(index, e.target.value)}
                placeholder="0.00"
                disabled={disabled}
                className="w-full pl-8 pr-3.5 h-11 bg-card border border-border/60 rounded-xl text-sm text-right shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary/40 focus:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-muted-foreground/50"
              />
            </div>
            {/* Delete button */}
            <button
              type="button"
              onClick={() => handleRemoveRow(index)}
              disabled={disabled}
              className="p-2 text-muted-foreground/50 hover:text-error transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              aria-label={t('expense.deleteExpense')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        {/* Add button */}
        {items.length < MAX_ITEMS && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddRow}
            disabled={disabled}
            className="w-full mt-2 rounded-xl border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            {t('expense.addExpense')}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
