/**
 * Property Card - Expandable card showing single rental property details
 * Clean layout with minimal color, clear hierarchy
 */
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import type { ScheduleEPropertyData } from '../../../../lib/api-client'
import { sanitizeText } from '../../../../lib/formatters'
import { formatUSD, getPropertyTypeLabel, formatAddress } from './format-utils'
import { CopyableValue, CopyableText, CopyableNumber } from './copyable-value'

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

export function PropertyCard({ property, isLocked: _isLocked }: PropertyCardProps) {
  const { t, i18n } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="rounded-xl overflow-hidden bg-card border border-border">
      {/* Collapsed Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors cursor-pointer"
        aria-expanded={isExpanded}
        aria-label={`${t('scheduleE.property')} ${property.id}`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Property Letter */}
          <span className="w-8 h-8 rounded-lg bg-muted text-muted-foreground text-sm font-semibold flex items-center justify-center flex-shrink-0">
            {property.id}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">
              {sanitizeText(formatAddress(property.address)) || t('scheduleE.noAddress')}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {getPropertyTypeLabel(property.propertyType, i18n.language === 'vi' ? 'vi' : 'en')}
              {property.propertyTypeOther && ` — ${sanitizeText(property.propertyTypeOther)}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5 ml-4">
          {/* Rent */}
          <div className="text-right hidden sm:block">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{t('scheduleE.rent')}</p>
            <p className="text-sm font-medium text-foreground tabular-nums">
              {formatUSD(property.rentsReceived)}
            </p>
          </div>

          {/* Net Income */}
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{t('scheduleE.netIncome')}</p>
            <p className="text-sm font-medium text-foreground tabular-nums">
              {formatUSD(property.netIncome)}
            </p>
          </div>

          {/* Expand Chevron */}
          <ChevronDown className={cn(
            'w-4 h-4 text-muted-foreground transition-transform duration-200 flex-shrink-0',
            isExpanded && 'rotate-180'
          )} />
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
          {/* Property Information Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {/* Address */}
            <div className="sm:col-span-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Line 1a · {t('scheduleE.address')}
              </p>
              <CopyableText
                text={`${sanitizeText(property.address.street)}, ${sanitizeText(property.address.city)}, ${sanitizeText(property.address.state)} ${sanitizeText(property.address.zip)}`}
                className="text-sm text-foreground"
              />
            </div>

            {/* Property Type */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Line 1b · {t('scheduleE.propertyType')}
              </p>
              <CopyableText
                text={`${property.propertyType} - ${getPropertyTypeLabel(property.propertyType, 'en')}`}
                copyValue={String(property.propertyType)}
                className="text-sm text-foreground"
              />
            </div>

            {/* Rents Received */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Line 3 · {t('scheduleE.rentsReceived')}
              </p>
              <CopyableValue
                formatted={formatUSD(property.rentsReceived)}
                rawValue={property.rentsReceived}
                className="text-sm font-medium text-foreground"
              />
            </div>

            {/* Fair Rental Days */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Line 2 · {t('scheduleE.fairRentalDays')}
              </p>
              <CopyableNumber
                value={property.fairRentalDays}
                formatted={`${property.fairRentalDays} days`}
                className="text-sm text-foreground"
              />
            </div>

            {/* Personal Use Days */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                {t('scheduleE.personalUseDays')}
              </p>
              <CopyableNumber
                value={property.personalUseDays}
                formatted={`${property.personalUseDays} days`}
                className="text-sm text-foreground"
              />
            </div>
          </div>

          {/* Expenses */}
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              {t('scheduleE.expenses')}
            </p>
            <div className="space-y-0.5">
              {EXPENSE_FIELDS.map(({ key, lineKey }) => {
                const value = property[key as keyof typeof property] as number
                if (value === 0) return null
                return (
                  <div key={key} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-muted-foreground">{t(lineKey)}</span>
                    <CopyableValue
                      formatted={formatUSD(value)}
                      rawValue={value}
                      className="text-sm tabular-nums"
                    />
                  </div>
                )
              })}

              {/* Custom Other Expenses */}
              {property.otherExpenses.map((expense, idx) => (
                <div key={`other-${idx}`} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-muted-foreground">
                    {t('scheduleE.line19Other')}: {sanitizeText(expense.name)}
                  </span>
                  <CopyableValue
                    formatted={formatUSD(expense.amount)}
                    rawValue={expense.amount}
                    className="text-sm tabular-nums"
                  />
                </div>
              ))}

              {/* Total Expenses */}
              <div className="flex items-center justify-between py-2 mt-1 border-t border-border font-medium">
                <span className="text-sm">{t('scheduleE.totalExpenses')}</span>
                <CopyableValue
                  formatted={formatUSD(property.totalExpenses)}
                  rawValue={property.totalExpenses}
                  className="text-sm font-semibold tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* Net Income/Loss — subtle, no colored background */}
          <div className="border-t border-border pt-3 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground uppercase tracking-wide">
              {property.netIncome >= 0 ? t('scheduleE.netProfit') : t('scheduleE.netLoss')}
            </span>
            <CopyableValue
              formatted={formatUSD(property.netIncome)}
              rawValue={property.netIncome}
              className="text-base font-semibold text-foreground"
            />
          </div>
        </div>
      )}
    </div>
  )
}
