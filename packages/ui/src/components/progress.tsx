import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'

// Linear Progress Bar
const progressBarVariants = cva('w-full overflow-hidden rounded-full bg-border', {
  variants: {
    size: {
      sm: 'h-1',
      default: 'h-2',
      lg: 'h-3',
    },
  },
  defaultVariants: {
    size: 'default',
  },
})

const progressBarFillVariants = cva('h-full rounded-full transition-all duration-300 ease-out', {
  variants: {
    variant: {
      default: 'bg-primary',
      success: 'bg-success',
      warning: 'bg-warning',
      error: 'bg-destructive',
      gradient: 'bg-gradient-to-r from-primary to-accent',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

export interface ProgressBarProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>,
    VariantProps<typeof progressBarVariants>,
    VariantProps<typeof progressBarFillVariants> {
  value: number
  max?: number
  showLabel?: boolean
  labelPosition?: 'inside' | 'outside'
  /** Custom label text (defaults to "Progress") */
  label?: string
}

const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  (
    {
      className,
      value,
      max = 100,
      size,
      variant,
      showLabel = false,
      labelPosition = 'outside',
      label = 'Progress',
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

    return (
      <div className={cn('w-full', className)}>
        {showLabel && labelPosition === 'outside' && (
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-secondary">{label}</span>
            <span className="font-medium text-foreground">{Math.round(percentage)}%</span>
          </div>
        )}
        <div ref={ref} className={cn(progressBarVariants({ size }))} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label} {...props}>
          <div
            className={cn(progressBarFillVariants({ variant }), 'relative')}
            style={{ width: `${percentage}%` }}
          >
            {showLabel && labelPosition === 'inside' && size === 'lg' && (
              <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-primary-foreground">
                {Math.round(percentage)}%
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }
)
ProgressBar.displayName = 'ProgressBar'

// Circular Progress
const circularProgressVariants = cva('relative inline-flex items-center justify-center', {
  variants: {
    size: {
      sm: 'h-10 w-10',
      default: 'h-16 w-16',
      lg: 'h-24 w-24',
      xl: 'h-32 w-32',
    },
  },
  defaultVariants: {
    size: 'default',
  },
})

const strokeWidths = {
  sm: 4,
  default: 6,
  lg: 8,
  xl: 10,
}

const textSizes = {
  sm: 'text-xs',
  default: 'text-sm',
  lg: 'text-lg',
  xl: 'text-2xl',
}

export interface CircularProgressProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>,
    VariantProps<typeof circularProgressVariants> {
  value: number
  max?: number
  variant?: 'default' | 'success' | 'warning' | 'error'
  showLabel?: boolean
  label?: string
}

const CircularProgress = React.forwardRef<HTMLDivElement, CircularProgressProps>(
  (
    {
      className,
      value,
      max = 100,
      size = 'default',
      variant = 'default',
      showLabel = true,
      label,
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100)
    const strokeWidth = strokeWidths[size ?? 'default']
    const radius = 50 - strokeWidth / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (percentage / 100) * circumference

    const strokeColors = {
      default: 'stroke-primary',
      success: 'stroke-success',
      warning: 'stroke-warning',
      error: 'stroke-destructive',
    }

    return (
      <div ref={ref} className={cn(circularProgressVariants({ size }), className)} {...props}>
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            className="stroke-border"
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            className={cn(strokeColors[variant], 'transition-all duration-300 ease-out')}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        {showLabel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('font-bold text-foreground', textSizes[size ?? 'default'])}>
              {Math.round(percentage)}%
            </span>
            {label && <span className="text-xs text-secondary mt-0.5">{label}</span>}
          </div>
        )}
      </div>
    )
  }
)
CircularProgress.displayName = 'CircularProgress'

export {
  ProgressBar,
  CircularProgress,
  progressBarVariants,
  progressBarFillVariants,
  circularProgressVariants,
}
