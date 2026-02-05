/**
 * OtherExpenseList Component
 * Dynamic add/delete rows for custom "Other" expenses
 * Each row: [expense name] + [amount] + [trash icon]
 * Max 20 items, names max 100 chars
 */
import { useCallback } from 'react'
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
  const handleAddRow = useCallback(() => {
    if (items.length >= MAX_ITEMS) return
    onChange([...items, { name: '', amount: null }])
  }, [items, onChange])

  const handleRemoveRow = useCallback((index: number) => {
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
    const updated = [...items]
    const parsed = rawValue === '' ? null : parseFloat(rawValue)
    updated[index] = { ...updated[index], amount: isNaN(parsed as number) ? null : parsed }
    onChange(updated)
  }, [items, onChange])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Package className="w-5 h-5 text-primary" />
          {t('expense.otherExpenses')}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
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
              className="flex-1 min-w-0 px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {/* Amount input with $ prefix */}
            <div className="relative w-32 flex-shrink-0">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={item.amount === null ? '' : item.amount}
                onChange={(e) => handleAmountChange(index, e.target.value)}
                placeholder="0.00"
                disabled={disabled}
                className="w-full pl-7 pr-3 py-2 bg-card border border-border rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            {/* Delete button */}
            <button
              type="button"
              onClick={() => handleRemoveRow(index)}
              disabled={disabled}
              className="p-2 text-muted-foreground hover:text-error transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="w-full mt-2"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            {t('expense.addExpense')}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
