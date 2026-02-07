/**
 * RentalAutoSaveIndicator Component
 * Shows auto-save status for rental form
 */
import { memo } from 'react'
import { Loader2, Check, AlertCircle } from 'lucide-react'
import { cn } from '@ella/ui'
import { useTranslation } from 'react-i18next'
import type { AutoSaveStatus } from '../hooks/use-rental-auto-save'

interface RentalAutoSaveIndicatorProps {
  status: AutoSaveStatus
  lastSaved: Date | null
  error: string | null
  className?: string
}

export const RentalAutoSaveIndicator = memo(function RentalAutoSaveIndicator({
  status,
  lastSaved,
  error,
  className,
}: RentalAutoSaveIndicatorProps) {
  const { t } = useTranslation()

  // Format time
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
          <span className="text-muted-foreground">{t('rental.autoSave.saving')}</span>
        </>
      )}

      {/* Saved */}
      {status === 'saved' && (
        <>
          <Check className="w-3 h-3 text-success" />
          <span className="text-success">{t('rental.autoSave.saved')}</span>
        </>
      )}

      {/* Idle with last saved */}
      {status === 'idle' && lastSaved && (
        <span className="text-muted-foreground">
          {t('rental.autoSave.savedAt', { time: formatTime(lastSaved) })}
        </span>
      )}

      {/* Error */}
      {status === 'error' && (
        <>
          <AlertCircle className="w-3 h-3 text-error" />
          <span className="text-error" title={error || undefined}>
            {t('rental.autoSave.failed')}
          </span>
        </>
      )}
    </div>
  )
})

RentalAutoSaveIndicator.displayName = 'RentalAutoSaveIndicator'
