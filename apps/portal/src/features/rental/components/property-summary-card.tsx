/**
 * PropertySummaryCard Component
 * Compact display of property data for review step
 */
import { memo } from 'react'
import { Building2, Edit2 } from 'lucide-react'
import { cn } from '@ella/ui'
import { useTranslation } from 'react-i18next'
import type { ScheduleEProperty } from '@ella/shared'
import { PROPERTY_TYPES } from '../lib/rental-categories'

interface PropertySummaryCardProps {
  property: ScheduleEProperty
  onEdit: () => void
  readOnly?: boolean
}

export const PropertySummaryCard = memo(function PropertySummaryCard({
  property,
  onEdit,
  readOnly = false,
}: PropertySummaryCardProps) {
  const { t } = useTranslation()

  // Get property type label
  const propertyTypeLabel = PROPERTY_TYPES.find((pt) => pt.value === property.propertyType)?.label || ''
  const displayType = property.propertyType === 8 && property.propertyTypeOther
    ? property.propertyTypeOther
    : propertyTypeLabel

  // Format currency
  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  }

  // Format address
  const formatAddress = () => {
    const { street, city, state, zip } = property.address
    if (!street && !city) return t('rental.noAddressEntered')
    const parts = [street, city, state, zip].filter(Boolean)
    return parts.join(', ')
  }

  // Calculate net income color
  const isProfit = property.netIncome >= 0

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            'bg-primary/10'
          )}>
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {t('rental.propertyLabel', { id: property.id })}
            </h3>
            <p className="text-xs text-muted-foreground">{displayType}</p>
          </div>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={onEdit}
            className="p-2 text-muted-foreground hover:text-primary transition-colors"
            aria-label={t('rental.editProperty')}
          >
            <Edit2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Address */}
      <p className="text-sm text-foreground mb-3 line-clamp-1">
        {formatAddress()}
      </p>

      {/* Rental period */}
      <div className="flex gap-4 text-xs text-muted-foreground mb-4">
        <span>{t('rental.monthsLabel', { months: property.monthsRented || 0 })}</span>
        <span>•</span>
        <span>{t('rental.personalDaysLabel', { days: property.personalUseDays || 0 })}</span>
      </div>

      {/* Financial summary */}
      <div className="space-y-2 pt-3 border-t border-border">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('rental.rentReceived')}</span>
          <span className="font-medium text-foreground">
            {formatCurrency(property.rentsReceived || 0)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('rental.totalExpenses')}</span>
          <span className="font-medium text-foreground">
            {formatCurrency(property.totalExpenses || 0)}
          </span>
        </div>
        <div className="flex justify-between text-sm pt-2 border-t border-border">
          <span className="font-medium text-foreground">{t('rental.netIncome')}</span>
          <span className={cn(
            'font-semibold',
            isProfit ? 'text-success' : 'text-error'
          )}>
            {isProfit ? '' : '-'}{formatCurrency(Math.abs(property.netIncome || 0))}
          </span>
        </div>
      </div>
    </div>
  )
})

PropertySummaryCard.displayName = 'PropertySummaryCard'
