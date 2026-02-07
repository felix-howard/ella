/**
 * PropertyCountStep Component
 * Step 1: Select number of rental properties (1-3)
 */
import { memo } from 'react'
import { Building2, ChevronRight } from 'lucide-react'
import { Button, cn } from '@ella/ui'
import { useTranslation } from 'react-i18next'

interface PropertyCountStepProps {
  value: 1 | 2 | 3
  onChange: (count: 1 | 2 | 3) => void
  onNext: () => void
  readOnly?: boolean
}

const PROPERTY_COUNTS: (1 | 2 | 3)[] = [1, 2, 3]

export const PropertyCountStep = memo(function PropertyCountStep({
  value,
  onChange,
  onNext,
  readOnly = false,
}: PropertyCountStepProps) {
  const { t } = useTranslation()

  return (
    <div className="flex-1 flex flex-col px-6 py-4">
      {/* Question */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-2">
          {t('rental.propertyCount')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('rental.propertyCountDescription')}
        </p>
      </div>

      {/* Property count buttons */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {PROPERTY_COUNTS.map((count) => (
          <button
            key={count}
            type="button"
            onClick={() => !readOnly && onChange(count)}
            disabled={readOnly}
            className={cn(
              'flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all',
              'hover:border-primary/50 hover:bg-primary/5',
              'focus:outline-none focus:ring-2 focus:ring-primary/20',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              value === count
                ? 'border-primary bg-primary/10 shadow-md'
                : 'border-border bg-card'
            )}
            aria-pressed={value === count}
            aria-label={t('rental.propertyCountLabel', { count })}
          >
            {/* Icon row */}
            <div className="flex items-center gap-1 mb-3">
              {Array.from({ length: count }).map((_, i) => (
                <Building2
                  key={i}
                  className={cn(
                    'w-6 h-6',
                    value === count ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
              ))}
            </div>

            {/* Number */}
            <span
              className={cn(
                'text-2xl font-bold',
                value === count ? 'text-primary' : 'text-foreground'
              )}
            >
              {count}
            </span>

            {/* Label */}
            <span
              className={cn(
                'text-sm mt-1',
                value === count ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {count === 1
                ? t('rental.property')
                : t('rental.properties')}
            </span>
          </button>
        ))}
      </div>

      {/* Next button */}
      <div className="mt-auto pt-4">
        <Button
          onClick={onNext}
          disabled={readOnly}
          className="w-full gap-2 h-14 text-base"
          size="lg"
        >
          {t('rental.next')}
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  )
})

PropertyCountStep.displayName = 'PropertyCountStep'
