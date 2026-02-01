/**
 * ProgressIndicator Component
 * Shows "X of Y fields completed" with visual progress bar
 */
import { cn } from '@ella/ui'
import { useTranslation, Trans } from 'react-i18next'

interface ProgressIndicatorProps {
  filled: number
  total: number
  className?: string
}

export function ProgressIndicator({
  filled,
  total,
  className,
}: ProgressIndicatorProps) {
  const { t } = useTranslation()
  const percentage = total > 0 ? Math.round((filled / total) * 100) : 0

  return (
    <div className={cn('space-y-2', className)}>
      {/* Text indicator */}
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">
          <Trans
            i18nKey="expense.progress.filled"
            values={{ filled, total }}
            components={{
              1: <span className="font-medium text-foreground" />
            }}
          />
        </span>
        <span className="text-muted-foreground">
          {percentage}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300 ease-out',
            percentage === 100 ? 'bg-success' : 'bg-primary'
          )}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('expense.progress.label', { filled, total })}
        />
      </div>

      {/* Completion message */}
      {percentage === 100 && (
        <p className="text-xs text-success font-medium">
          {t('expense.progress.complete')}
        </p>
      )}
    </div>
  )
}
