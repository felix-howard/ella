/**
 * ReviewStep Component
 * Final step: Review all properties and submit
 */
import { memo, useMemo } from 'react'
import { ChevronLeft, Send, Loader2 } from 'lucide-react'
import { Button, cn } from '@ella/ui'
import { useTranslation } from 'react-i18next'
import type { ScheduleEProperty } from '@ella/shared'
import { PropertySummaryCard } from './property-summary-card'

interface ReviewStepProps {
  properties: ScheduleEProperty[]
  onEditProperty: (propertyIndex: number) => void
  onBack: () => void
  onSubmit: () => void
  isSubmitting: boolean
  isLocked: boolean
}

export const ReviewStep = memo(function ReviewStep({
  properties,
  onEditProperty,
  onBack,
  onSubmit,
  isSubmitting,
  isLocked,
}: ReviewStepProps) {
  const { t } = useTranslation()

  // Calculate totals
  const totals = useMemo(() => {
    return properties.reduce(
      (acc, p) => ({
        totalRent: acc.totalRent + (p.rentsReceived || 0),
        totalExpenses: acc.totalExpenses + (p.totalExpenses || 0),
        totalNet: acc.totalNet + (p.netIncome || 0),
      }),
      { totalRent: 0, totalExpenses: 0, totalNet: 0 }
    )
  }, [properties])

  // Format currency with decimals
  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const isProfit = totals.totalNet >= 0

  return (
    <div className="flex-1 flex flex-col px-6 py-4 overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">
          {t('rental.review')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('rental.reviewDescription')}
        </p>
      </div>

      {/* Property cards */}
      <div className="space-y-4 mb-6">
        {properties.map((property, index) => (
          <PropertySummaryCard
            key={property.id}
            property={property}
            onEdit={() => onEditProperty(index)}
            readOnly={isLocked}
          />
        ))}
      </div>

      {/* Overall totals */}
      <div className="bg-muted rounded-xl p-4 mb-6">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          {t('rental.overallSummary')}
        </h3>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('rental.totalRentAllProperties')}</span>
            <span className="font-medium text-foreground">
              {formatCurrency(totals.totalRent)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('rental.totalExpensesAllProperties')}</span>
            <span className="font-medium text-foreground">
              {formatCurrency(totals.totalExpenses)}
            </span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-border/50">
            <span className="font-semibold text-foreground">{t('rental.totalNetIncome')}</span>
            <span className={cn(
              'font-bold text-lg',
              isProfit ? 'text-success' : 'text-error'
            )}>
              {isProfit ? '' : '-'}{formatCurrency(Math.abs(totals.totalNet))}
            </span>
          </div>
        </div>
      </div>

      {/* Locked notice */}
      {isLocked && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 mb-6">
          <p className="text-sm text-warning">
            {t('rental.formLockedMessage')}
          </p>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="mt-auto pt-4 flex gap-3">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isSubmitting}
          className="flex-1 gap-2 h-12"
          size="lg"
        >
          <ChevronLeft className="w-5 h-5" />
          {t('rental.back')}
        </Button>
        <Button
          onClick={onSubmit}
          disabled={isSubmitting || isLocked}
          className="flex-1 gap-2 h-12"
          size="lg"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('rental.submitting')}
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              {t('rental.submitToCPA')}
            </>
          )}
        </Button>
      </div>
    </div>
  )
})

ReviewStep.displayName = 'ReviewStep'
