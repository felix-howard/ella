/**
 * ExpenseSection Component
 * Groups related expense categories into an always-expanded section
 * Optimized with memo to prevent unnecessary re-renders
 */
import { useMemo, memo } from 'react'
import { ClipboardList, Briefcase, Home, Landmark, Users, Car, FileText, Package } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@ella/ui'
import { ExpenseField } from './expense-field'
import { getCategoriesByGroup, GROUP_LABELS, type CategoryGroup } from '../lib/expense-categories'

// Lucide icons for each expense group
const GROUP_ICONS: Record<CategoryGroup, React.ReactNode> = {
  income: null,
  general: <ClipboardList className="w-5 h-5 text-primary" />,
  professional: <Briefcase className="w-5 h-5 text-primary" />,
  property: <Home className="w-5 h-5 text-primary" />,
  financial: <Landmark className="w-5 h-5 text-primary" />,
  people: <Users className="w-5 h-5 text-primary" />,
  car: <Car className="w-5 h-5 text-primary" />,
  vehicle: <FileText className="w-5 h-5 text-primary" />,
  other: <Package className="w-5 h-5 text-primary" />,
}

interface ExpenseSectionProps {
  group: CategoryGroup
  formData: Record<string, unknown>
  onChange: (field: string, value: unknown) => void
  /** @deprecated All sections are always expanded now */
  defaultExpanded?: boolean
}

export const ExpenseSection = memo(function ExpenseSection({
  group,
  formData,
  onChange,
}: ExpenseSectionProps) {
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

  return (
    <Card>
      <CardHeader>
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
          {sectionTotal > 0 && (
            <span className="text-sm font-medium text-primary">
              ${sectionTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
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
    </Card>
  )
})

ExpenseSection.displayName = 'ExpenseSection'
