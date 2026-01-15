/**
 * ProgressIndicator - Progress display with current/total counts
 * Wrapper around ProgressBar with built-in count display
 * Shows progress as "X/Y (Z%)" format for verification workflows
 * Includes ARIA live regions for accessibility
 */

import { cn, ProgressBar, type ProgressBarProps } from '@ella/ui'

export interface ProgressIndicatorProps
  extends Omit<ProgressBarProps, 'value' | 'max' | 'showLabel' | 'label'> {
  /** Number of completed items */
  current: number
  /** Total number of items */
  total: number
  /** Label text (defaults to showing count) */
  label?: string
  /** Additional CSS classes */
  className?: string
  /** Whether to show percentage */
  showPercentage?: boolean
}

export function ProgressIndicator({
  current,
  total,
  label,
  className,
  showPercentage = true,
  variant = 'default',
  size = 'default',
  ...props
}: ProgressIndicatorProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0
  const displayLabel = label || 'Tiến độ'

  return (
    <div
      className={cn('space-y-1', className)}
      role="group"
      aria-label={displayLabel}
    >
      {/* Label row with count/percentage */}
      <div className="flex justify-between text-sm">
        <span className="text-secondary">{displayLabel}</span>
        <span
          className="font-medium text-foreground"
          aria-live="polite"
          aria-atomic="true"
        >
          {current}/{total}
          {showPercentage && (
            <span className="text-muted-foreground ml-1">({percentage}%)</span>
          )}
        </span>
      </div>

      {/* Progress bar */}
      <ProgressBar
        value={current}
        max={total}
        variant={variant}
        size={size}
        label={displayLabel}
        {...props}
      />
    </div>
  )
}

/**
 * CompactProgressIndicator - Inline progress with count only
 * For use in table cells or tight spaces
 */
export interface CompactProgressIndicatorProps {
  /** Number of completed items */
  current: number
  /** Total number of items */
  total: number
  /** Additional CSS classes */
  className?: string
  /** Show as percentage instead of count */
  asPercentage?: boolean
  /** Accessible label for screen readers */
  ariaLabel?: string
}

export function CompactProgressIndicator({
  current,
  total,
  className,
  asPercentage = false,
  ariaLabel = 'Tiến độ',
}: CompactProgressIndicatorProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0
  const isComplete = current >= total && total > 0

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={ariaLabel}
    >
      {/* Mini progress bar */}
      <div
        className="w-16 h-1.5 bg-border rounded-full overflow-hidden"
        aria-hidden="true"
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            isComplete ? 'bg-primary' : 'bg-primary/70'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Count or percentage */}
      <span
        className={cn(
          'text-xs font-medium min-w-[3rem]',
          isComplete ? 'text-primary' : 'text-muted-foreground'
        )}
        aria-live="polite"
      >
        {asPercentage ? `${percentage}%` : `${current}/${total}`}
      </span>
    </div>
  )
}
