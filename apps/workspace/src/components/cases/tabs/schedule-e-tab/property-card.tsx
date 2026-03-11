/**
 * Property Card - Expandable card showing single rental property details
 * Redesigned with cleaner layout, better hierarchy, and less visual noise
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

// Property badge colors by letter index
const BADGE_COLORS = [
  'bg-primary/10 text-primary',
  'bg-blue-500/10 text-blue-500',
  'bg-violet-500/10 text-violet-500',
  'bg-orange-500/10 text-orange-500',
  'bg-pink-500/10 text-pink-500',
  'bg-cyan-500/10 text-cyan-500',
  'bg-amber-500/10 text-amber-500',
  'bg-rose-500/10 text-rose-500',
]

function getBadgeColor(id: string): string {
  const index = id.charCodeAt(0) - 65 // A=0, B=1, etc.
  return BADGE_COLORS[index % BADGE_COLORS.length]
}

export function PropertyCard({ property, isLocked }: PropertyCardProps) {
  const { t, i18n } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)

  const netIsPositive = property.netIncome >= 0
  const badgeColor = getBadgeColor(property.id)

  return (
    <div className={cn(
      'rounded-xl overflow-hidden transition-all duration-200',
      'bg-card border border-border/60 dark:border-white/[0.06]',
      isExpanded && 'ring-1 ring-primary/20'
    )}>
      {/* Collapsed Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors cursor-pointer"
        aria-expanded={isExpanded}
        aria-label={`${t('scheduleE.property')} ${property.id}`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Property Letter Badge */}
          <span className={cn(
            'w-9 h-9 rounded-lg text-sm font-bold flex items-center justify-center flex-shrink-0',
            badgeColor
          )}>
            {property.id}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">
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
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-0.5">{t('scheduleE.rent')}</p>
            <p className="text-sm font-semibold text-foreground tabular-nums">
              {formatUSD(property.rentsReceived)}
            </p>
          </div>

          {/* Net Income */}
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-0.5">{t('scheduleE.netIncome')}</p>
            <p className={cn(
              'text-sm font-semibold tabular-nums',
              netIsPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            )}>
              {formatUSD(property.netIncome)}
            </p>
          </div>

          {/* Expand Chevron */}
          <ChevronDown className={cn(
            'w-4 h-4 text-muted-foreground/60 transition-transform duration-200 flex-shrink-0',
            isExpanded && 'rotate-180'
          )} />
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-border/60 px-4 pb-4 pt-3 space-y-4">
          {/* Property Information Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {/* Address */}
            <div className="sm:col-span-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">
                Line 1a · {t('scheduleE.address')}
              </p>
              <CopyableText
                text={`${sanitizeText(property.address.street)}, ${sanitizeText(property.address.city)}, ${sanitizeText(property.address.state)} ${sanitizeText(property.address.zip)}`}
                className="text-sm text-foreground font-medium"
              />
            </div>

            {/* Property Type */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">
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
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">
                Line 3 · {t('scheduleE.rentsReceived')}
              </p>
              <CopyableValue
                formatted={formatUSD(property.rentsReceived)}
                rawValue={property.rentsReceived}
                className="text-sm font-semibold text-foreground"
              />
            </div>

            {/* Fair Rental Days */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">
                Line 2 · {t('scheduleE.fairRentalDays')}
              </p>
              <CopyableNumber
                value={property.fairRentalDays}
                formatted={`${property.fairRentalDays} days`}
                className="text-sm font-medium text-foreground"
              />
            </div>

            {/* Personal Use Days */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">
                {t('scheduleE.personalUseDays')}
              </p>
              <CopyableNumber
                value={property.personalUseDays}
                formatted={`${property.personalUseDays} days`}
                className="text-sm text-foreground"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border/40" />

          {/* Expenses */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2">
              {t('scheduleE.expenses')}
            </p>
            <div className="space-y-0.5">
              {EXPENSE_FIELDS.map(({ key, lineKey }) => {
                const value = property[key as keyof typeof property] as number
                if (value === 0) return null
                return (
                  <div key={key} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/30 transition-colors group">
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
                <div key={`other-${idx}`} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/30 transition-colors group">
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
              <div className="flex items-center justify-between py-2 px-2 mt-1 rounded-lg bg-muted/40 dark:bg-white/[0.03] font-medium">
                <span className="text-sm">{t('scheduleE.totalExpenses')}</span>
                <CopyableValue
                  formatted={formatUSD(property.totalExpenses)}
                  rawValue={property.totalExpenses}
                  className="text-sm font-semibold tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* Net Income/Loss */}
          <div className={cn(
            'rounded-lg px-4 py-3 flex items-center justify-between',
            netIsPositive
              ? 'bg-green-500/5 dark:bg-green-500/10 ring-1 ring-green-500/20'
              : 'bg-red-500/5 dark:bg-red-500/10 ring-1 ring-red-500/20'
          )}>
            <span className={cn(
              'text-sm font-semibold',
              netIsPositive ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
            )}>
              {netIsPositive ? t('scheduleE.netProfit') : t('scheduleE.netLoss')}
            </span>
            <CopyableValue
              formatted={formatUSD(Math.abs(property.netIncome))}
              rawValue={Math.abs(property.netIncome)}
              className={cn(
                'text-base font-bold',
                netIsPositive ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
              )}
            />
          </div>
        </div>
      )}
    </div>
  )
}
