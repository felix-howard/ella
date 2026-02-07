/**
 * PropertyCountStep Component
 * Step 1: Select number of rental properties (1-3)
 * Shows confirmation modal when reducing count from a previously submitted value
 */
import { memo, useState, useCallback } from 'react'
import { Building2, ChevronRight, AlertTriangle } from 'lucide-react'
import { Button, cn } from '@ella/ui'
import { useTranslation } from 'react-i18next'

interface PropertyCountStepProps {
  value: 1 | 2 | 3
  onChange: (count: 1 | 2 | 3) => void
  onNext: () => void
  readOnly?: boolean
  /** Previously submitted property count — used to detect reductions */
  initialPropertyCount?: 1 | 2 | 3
}

const PROPERTY_COUNTS: (1 | 2 | 3)[] = [1, 2, 3]

export const PropertyCountStep = memo(function PropertyCountStep({
  value,
  onChange,
  onNext,
  readOnly = false,
  initialPropertyCount,
}: PropertyCountStepProps) {
  const { t } = useTranslation()
  const [pendingCount, setPendingCount] = useState<1 | 2 | 3 | null>(null)

  const handleSelect = useCallback((count: 1 | 2 | 3) => {
    // Show confirmation if reducing below the previously submitted count
    if (initialPropertyCount && count < initialPropertyCount) {
      setPendingCount(count)
      return
    }
    onChange(count)
  }, [initialPropertyCount, onChange])

  const confirmReduce = useCallback(() => {
    if (pendingCount !== null) {
      onChange(pendingCount)
      setPendingCount(null)
    }
  }, [pendingCount, onChange])

  const cancelReduce = useCallback(() => {
    setPendingCount(null)
  }, [])

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
            onClick={() => !readOnly && handleSelect(count)}
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

      {/* Confirmation modal when reducing property count */}
      {pendingCount !== null && initialPropertyCount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-card rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            {/* Warning icon + title */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {t('rental.reducePropertyTitle')}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('rental.reducePropertyMessage', {
                    from: initialPropertyCount,
                    to: pendingCount,
                  })}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-2">
              <Button
                variant="outline"
                onClick={cancelReduce}
                className="w-full h-12"
              >
                {t('rental.reducePropertyCancel', { count: initialPropertyCount })}
              </Button>
              <Button
                variant="destructive"
                onClick={confirmReduce}
                className="w-full h-12"
              >
                {t('rental.reducePropertyConfirm', { count: pendingCount })}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

PropertyCountStep.displayName = 'PropertyCountStep'
