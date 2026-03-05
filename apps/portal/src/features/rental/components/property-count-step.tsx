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
    <div className="flex-1 flex flex-col px-6 py-6">
      {/* Question */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          {t('rental.propertyCount')}
        </h2>
        <p className="text-sm text-muted-foreground/80">
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
              'flex flex-col items-center justify-center p-6 rounded-2xl transition-all duration-200 cursor-pointer',
              'focus:outline-none focus:ring-2 focus:ring-primary/20',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              value === count
                ? 'bg-primary/5 shadow-lg ring-2 ring-primary/25'
                : 'bg-card shadow-sm border border-border/40 hover:shadow-md hover:border-primary/30'
            )}
            aria-pressed={value === count}
            aria-label={t('rental.propertyCountLabel', { count })}
          >
            {/* Icon row */}
            <div className="flex items-center gap-1.5 mb-3">
              {Array.from({ length: count }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    value === count ? 'bg-primary/15' : 'bg-muted'
                  )}
                >
                  <Building2 className={cn(
                    'w-4 h-4',
                    value === count ? 'text-primary' : 'text-muted-foreground'
                  )} />
                </div>
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
                value === count ? 'text-primary font-medium' : 'text-muted-foreground'
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
          className="w-full gap-2 h-14 text-base rounded-xl shadow-md"
          size="lg"
        >
          {t('rental.next')}
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Confirmation modal when reducing property count */}
      {pendingCount !== null && initialPropertyCount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-card rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            {/* Warning icon + title */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
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
                className="w-full h-12 rounded-xl"
              >
                {t('rental.reducePropertyCancel', { count: initialPropertyCount })}
              </Button>
              <Button
                variant="destructive"
                onClick={confirmReduce}
                className="w-full h-12 rounded-xl shadow-md"
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
