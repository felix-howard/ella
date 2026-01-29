/**
 * ProgressIndicator Component
 * Shows "X of Y fields completed" with visual progress bar
 */
import { cn } from '@ella/ui'

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
  const percentage = total > 0 ? Math.round((filled / total) * 100) : 0

  return (
    <div className={cn('space-y-2', className)}>
      {/* Text indicator */}
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">
          Đã điền: <span className="font-medium text-foreground">{filled}</span> / {total} mục
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
          aria-label={`${filled} trong ${total} mục đã điền`}
        />
      </div>

      {/* Completion message */}
      {percentage === 100 && (
        <p className="text-xs text-success font-medium">
          ✓ Đã điền đầy đủ tất cả các mục!
        </p>
      )}
    </div>
  )
}
