/**
 * ExpenseSection Component
 * Groups related expense categories into a collapsible section
 * Optimized with memo to prevent unnecessary re-renders
 */
import { useState, useMemo, useCallback, memo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ella/ui'
import { cn } from '@ella/ui'
import { ExpenseField } from './expense-field'
import { getCategoriesByGroup, GROUP_LABELS, type CategoryGroup } from '../lib/expense-categories'

// Icons for each group
const GROUP_ICONS: Record<CategoryGroup, React.ReactNode> = {
  income: null,
  general: '📋',
  professional: '💼',
  property: '🏠',
  financial: '💰',
  people: '👥',
  car: '🚗',
  vehicle: '📝',
  other: '📦',
}

interface ExpenseSectionProps {
  group: CategoryGroup
  formData: Record<string, unknown>
  onChange: (field: string, value: unknown) => void
  defaultExpanded?: boolean
}

export const ExpenseSection = memo(function ExpenseSection({
  group,
  formData,
  onChange,
  defaultExpanded = true,
}: ExpenseSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  // Get categories for this group
  const categories = useMemo(() => getCategoriesByGroup(group), [group])

  // Calculate section total
  const sectionTotal = useMemo(() => {
    return categories.reduce((sum, cat) => {
      const value = formData[cat.field]
      if (typeof value === 'number' && cat.type === 'currency') {
        return sum + value
      }
      return sum
    }, 0)
  }, [categories, formData])

  // Count filled fields in this section
  const filledCount = useMemo(() => {
    return categories.filter(cat => {
      const value = formData[cat.field]
      return value !== null && value !== undefined && value !== '' && value !== 0
    }).length
  }, [categories, formData])

  // Toggle expansion
  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev)
  }, [])

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={toggleExpanded}
        role="button"
        aria-expanded={isExpanded}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggleExpanded()
          }
        }}
      >
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base font-semibold text-foreground">
            <span aria-hidden="true">{GROUP_ICONS[group]}</span>
            {GROUP_LABELS[group]}
            {filledCount > 0 && (
              <span className="text-xs font-normal text-muted-foreground">
                ({filledCount}/{categories.length})
              </span>
            )}
          </span>
          <span className="flex items-center gap-3">
            {sectionTotal > 0 && (
              <span className="text-sm font-medium text-primary">
                ${sectionTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </span>
        </CardTitle>
      </CardHeader>

      <div
        className={cn(
          'overflow-hidden transition-all duration-200 ease-in-out',
          isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <CardContent className="pt-0">
          <div className="grid gap-4 sm:grid-cols-2">
            {categories.map((category) => (
              <ExpenseField
                key={category.field}
                category={category}
                value={formData[category.field] as number | string | null}
                onChange={(value) => onChange(category.field, value)}
              />
            ))}
          </div>
        </CardContent>
      </div>
    </Card>
  )
})

ExpenseSection.displayName = 'ExpenseSection'
