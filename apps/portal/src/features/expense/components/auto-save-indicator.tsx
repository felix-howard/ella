/**
 * AutoSaveIndicator Component
 * Shows auto-save status near submit button
 */
import { Loader2, Check, AlertCircle } from 'lucide-react'
import { cn } from '@ella/ui'
import type { AutoSaveStatus } from '../hooks/use-auto-save'

interface AutoSaveIndicatorProps {
  status: AutoSaveStatus
  lastSaved: Date | null
  error: string | null
  className?: string
}

export function AutoSaveIndicator({
  status,
  lastSaved,
  error,
  className,
}: AutoSaveIndicatorProps) {
  // Format time as HH:MM
  const formatTime = (date: Date | null): string => {
    if (!date) return ''
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Don't show anything if idle and never saved
  if (status === 'idle' && !lastSaved) {
    return null
  }

  return (
    <div className={cn('flex items-center gap-1.5 text-xs', className)}>
      {/* Saving */}
      {status === 'saving' && (
        <>
          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Đang lưu...</span>
        </>
      )}

      {/* Saved */}
      {status === 'saved' && (
        <>
          <Check className="w-3 h-3 text-success" />
          <span className="text-success">Đã lưu tự động</span>
        </>
      )}

      {/* Idle with last saved */}
      {status === 'idle' && lastSaved && (
        <span className="text-muted-foreground">
          Đã lưu lúc {formatTime(lastSaved)}
        </span>
      )}

      {/* Error */}
      {status === 'error' && (
        <>
          <AlertCircle className="w-3 h-3 text-error" />
          <span className="text-error" title={error || undefined}>
            Lưu thất bại
          </span>
        </>
      )}
    </div>
  )
}
