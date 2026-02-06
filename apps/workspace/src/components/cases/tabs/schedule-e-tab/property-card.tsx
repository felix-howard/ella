/**
 * Property Card - Expandable card showing single rental property details
 * Displays address, type, rental period, income, and expenses with copyable values
 */
import { useState } from 'react'
import { ChevronDown, ChevronUp, MapPin, Calendar, DollarSign } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import type { ScheduleEPropertyData } from '../../../../lib/api-client'
import { sanitizeText } from '../../../../lib/formatters'
import { formatUSD, getPropertyTypeLabel, formatAddress } from './format-utils'
import { CopyableValue } from './copyable-value'

interface PropertyCardProps {
  property: ScheduleEPropertyData
  isLocked: boolean
}

// Expense fields with IRS line numbers for display
const EXPENSE_FIELDS = [
  { key: 'insurance', lineKey: 'scheduleE.line9Insurance' },
  { key: 'mortgageInterest', lineKey: 'scheduleE.line12MortgageInterest' },
  { key: 'repairs', lineKey: 'scheduleE.line14Repairs' },
  { key: 'taxes', lineKey: 'scheduleE.line16Taxes' },
  { key: 'utilities', lineKey: 'scheduleE.line17Utilities' },
  { key: 'managementFees', lineKey: 'scheduleE.line11ManagementFees' },
  { key: 'cleaningMaintenance', lineKey: 'scheduleE.line7CleaningMaintenance' },
] as const

export function PropertyCard({ property, isLocked }: PropertyCardProps) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)

  const netIsPositive = property.netIncome >= 0

  return (
    <div className={cn(
      'border rounded-lg overflow-hidden transition-colors',
      isLocked ? 'border-gray-200 dark:border-gray-700' : 'border-border'
    )}>
      {/* Collapsed Header - Always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
        aria-expanded={isExpanded}
        aria-label={`${t('scheduleE.property')} ${property.id}`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Property Letter Badge */}
          <span className="w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center flex-shrink-0">
            {property.id}
          </span>

          <div className="min-w-0 flex-1">
            {/* Address - sanitized to prevent XSS */}
            <p className="text-sm font-medium text-foreground truncate">
              {sanitizeText(formatAddress(property.address)) || t('scheduleE.noAddress')}
            </p>
            {/* Property Type */}
            <p className="text-xs text-muted-foreground">
              {getPropertyTypeLabel(property.propertyType)}
              {property.propertyTypeOther && ` - ${sanitizeText(property.propertyTypeOther)}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 ml-4">
          {/* Rent Preview */}
          <div className="text-right hidden sm:block">
            <p className="text-xs text-muted-foreground">{t('scheduleE.rent')}</p>
            <p className="text-sm font-medium text-foreground tabular-nums">
              {formatUSD(property.rentsReceived)}
            </p>
          </div>

          {/* Net Income Preview */}
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{t('scheduleE.netIncome')}</p>
            <p className={cn(
              'text-sm font-medium tabular-nums',
              netIsPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            )}>
              {formatUSD(property.netIncome)}
            </p>
          </div>

          {/* Expand Icon */}
          <div className="flex-shrink-0">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-border p-4 space-y-4 bg-muted/30">
          {/* Property Details Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Address */}
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{t('scheduleE.address')}</p>
                <p className="text-sm text-foreground">
                  {sanitizeText(property.address.street)}<br />
                  {sanitizeText(property.address.city)}, {sanitizeText(property.address.state)} {sanitizeText(property.address.zip)}
                </p>
              </div>
            </div>

            {/* Rental Period */}
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{t('scheduleE.rentalPeriod')}</p>
                <p className="text-sm text-foreground">
                  {t('scheduleE.monthsRented', { count: property.monthsRented })}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('scheduleE.rentalDays', { days: property.fairRentalDays })} /
                  {t('scheduleE.personalDays', { days: property.personalUseDays })}
                </p>
              </div>
            </div>

            {/* Income */}
            <div className="flex items-start gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{t('scheduleE.rentsReceived')}</p>
                <CopyableValue
                  formatted={formatUSD(property.rentsReceived)}
                  rawValue={property.rentsReceived}
                  className="text-sm font-medium"
                />
              </div>
            </div>
          </div>

          {/* Expenses Table */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              {t('scheduleE.expenses')}
            </h4>
            <div className="bg-background rounded-lg border border-border">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {EXPENSE_FIELDS.map(({ key, lineKey }) => {
                    const value = property[key as keyof typeof property] as number
                    if (value === 0) return null
                    return (
                      <tr key={key}>
                        <td className="px-3 py-2 text-muted-foreground">{t(lineKey)}</td>
                        <td className="px-3 py-2 text-right">
                          <CopyableValue
                            formatted={formatUSD(value)}
                            rawValue={value}
                          />
                        </td>
                      </tr>
                    )
                  })}

                  {/* Custom Other Expenses - names sanitized to prevent XSS */}
                  {property.otherExpenses.map((expense, idx) => (
                    <tr key={`other-${idx}`}>
                      <td className="px-3 py-2 text-muted-foreground">
                        {t('scheduleE.line19Other')}: {sanitizeText(expense.name)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <CopyableValue
                          formatted={formatUSD(expense.amount)}
                          rawValue={expense.amount}
                        />
                      </td>
                    </tr>
                  ))}

                  {/* Total Expenses Row */}
                  <tr className="bg-muted/50 font-medium">
                    <td className="px-3 py-2">{t('scheduleE.totalExpenses')}</td>
                    <td className="px-3 py-2 text-right">
                      <CopyableValue
                        formatted={formatUSD(property.totalExpenses)}
                        rawValue={property.totalExpenses}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Net Income Summary */}
          <div className={cn(
            'rounded-lg p-3 flex items-center justify-between',
            netIsPositive
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          )}>
            <span className={cn(
              'text-sm font-medium',
              netIsPositive ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
            )}>
              {netIsPositive ? t('scheduleE.netProfit') : t('scheduleE.netLoss')}
            </span>
            <CopyableValue
              formatted={formatUSD(Math.abs(property.netIncome))}
              rawValue={Math.abs(property.netIncome)}
              className={cn(
                'font-semibold',
                netIsPositive ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
              )}
            />
          </div>
        </div>
      )}
    </div>
  )
}
