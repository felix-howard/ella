import { CreditCard, UserCheck } from 'lucide-react'
import { cn } from '@ella/ui'
import type { AgreementPaymentPortalSendMode } from '../../lib/api-client'

interface CalculatorPaymentModeControlProps {
  value: AgreementPaymentPortalSendMode
  onChange: (value: AgreementPaymentPortalSendMode) => void
  name: string
  disabled?: boolean
  compact?: boolean
  t: (key: string) => string
}

const OPTIONS: Array<{
  value: AgreementPaymentPortalSendMode
  labelKey: string
  descriptionKey: string
  Icon: typeof CreditCard
}> = [
  {
    value: 'AUTO_SEND',
    labelKey: 'settings.calculatorPaymentAutoSend',
    descriptionKey: 'settings.calculatorPaymentAutoSendDescription',
    Icon: CreditCard,
  },
  {
    value: 'STAFF_REVIEW',
    labelKey: 'settings.calculatorPaymentStaffReview',
    descriptionKey: 'settings.calculatorPaymentStaffReviewDescription',
    Icon: UserCheck,
  },
]

export function CalculatorPaymentModeControl({
  value,
  onChange,
  name,
  disabled = false,
  compact = false,
  t,
}: CalculatorPaymentModeControlProps) {
  return (
    <div
      className={cn(
        'grid gap-2',
        compact ? 'sm:grid-cols-2' : 'md:grid-cols-2',
      )}
      role="radiogroup"
      aria-label={t('settings.calculatorPaymentAfterSignature')}
    >
      {OPTIONS.map(({ value: optionValue, labelKey, descriptionKey, Icon }) => {
        const selected = value === optionValue
        return (
          <label
            key={optionValue}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors',
              selected
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
              disabled && 'cursor-not-allowed opacity-60 hover:border-border',
            )}
          >
            <input
              type="radio"
              name={name}
              value={optionValue}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(optionValue)}
              className="sr-only"
            />
            <span
              className={cn(
                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-primary',
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">
                {t(labelKey)}
              </span>
              <span className="block text-xs leading-5 text-muted-foreground">
                {t(descriptionKey)}
              </span>
            </span>
          </label>
        )
      })}
    </div>
  )
}
