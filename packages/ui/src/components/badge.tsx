import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center justify-center font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-muted text-muted-foreground',
        outline: 'border border-border text-foreground bg-transparent',
        success: 'bg-primary-light text-primary-dark',
        error: 'bg-error-light text-error',
        warning: 'bg-warning-light text-warning',
        accent: 'bg-accent text-accent-foreground',
      },
      size: {
        sm: 'px-2 py-0.5 text-[10px] leading-tight',
        default: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
      shape: {
        default: 'rounded-full',
        square: 'rounded-md',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      shape: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, shape, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant, size, shape, className }))} {...props} />
  )
)
Badge.displayName = 'Badge'

// Status Badge - specialized for document/case status display
export type StatusType =
  | 'missing'
  | 'has_raw'
  | 'has_digital'
  | 'verified'
  | 'uploaded'
  | 'classified'
  | 'linked'
  | 'blurry'
  | 'extracted'
  | 'partial'
  | 'failed'
  | 'pending'
  | 'in_progress'
  | 'complete'

const statusVariantMap: Record<StatusType, VariantProps<typeof badgeVariants>['variant']> = {
  missing: 'error',
  has_raw: 'warning',
  has_digital: 'secondary',
  verified: 'success',
  uploaded: 'secondary',
  classified: 'secondary',
  linked: 'default',
  blurry: 'error',
  extracted: 'secondary',
  partial: 'warning',
  failed: 'error',
  pending: 'secondary',
  in_progress: 'warning',
  complete: 'success',
}

export interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: StatusType
}

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, className, ...props }, ref) => (
    <Badge
      ref={ref}
      variant={statusVariantMap[status] || 'secondary'}
      className={className}
      {...props}
    />
  )
)
StatusBadge.displayName = 'StatusBadge'

export { Badge, badgeVariants, StatusBadge }
