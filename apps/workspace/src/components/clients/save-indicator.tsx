/**
 * SaveIndicator - Visual feedback for auto-save status
 * Shows saving spinner, saved confirmation, or error state
 */

import { Loader2, Check, AlertCircle } from 'lucide-react'
import { cn } from '@ella/ui'

interface SaveIndicatorProps {
  /** Whether save is in progress */
  isSaving: boolean
  /** Whether there's a pending (debounced) save */
  isPending?: boolean
  /** Error message if save failed */
  error?: string | null
  /** Position: fixed at bottom-right or inline */
  position?: 'fixed' | 'inline'
  /** Custom class name */
  className?: string
}

export function SaveIndicator({
  isSaving,
  isPending = false,
  error,
  position = 'fixed',
  className,
}: SaveIndicatorProps) {
  // Show nothing if no activity
  if (!isSaving && !isPending && !error) {
    return null
  }

  const content = (
    <>
      {isSaving && (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Đang lưu...</span>
        </>
      )}
      {!isSaving && isPending && (
        <>
          <div className="w-4 h-4 rounded-full bg-warning/20 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
          </div>
          <span className="text-sm text-muted-foreground">Chờ lưu...</span>
        </>
      )}
      {error && (
        <>
          <AlertCircle className="w-4 h-4 text-destructive" />
          <span className="text-sm text-destructive">{error}</span>
        </>
      )}
    </>
  )

  if (position === 'fixed') {
    return (
      <div
        className={cn(
          'fixed bottom-4 right-4 flex items-center gap-2 bg-card px-3 py-2 rounded-full shadow-lg border border-border z-50',
          className
        )}
      >
        {content}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50',
        className
      )}
    >
      {content}
    </div>
  )
}

/**
 * SavedBadge - Brief "Saved" confirmation that auto-hides
 */
interface SavedBadgeProps {
  /** Whether to show the badge */
  show: boolean
  /** Position: fixed or inline */
  position?: 'fixed' | 'inline'
  /** Custom class name */
  className?: string
}

export function SavedBadge({
  show,
  position = 'fixed',
  className,
}: SavedBadgeProps) {
  if (!show) return null

  const content = (
    <>
      <Check className="w-4 h-4 text-success" />
      <span className="text-sm text-success">Đã lưu</span>
    </>
  )

  if (position === 'fixed') {
    return (
      <div
        className={cn(
          'fixed bottom-4 right-4 flex items-center gap-2 bg-card px-3 py-2 rounded-full shadow-lg border border-success/30 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200',
          className
        )}
      >
        {content}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success/10',
        className
      )}
    >
      {content}
    </div>
  )
}
