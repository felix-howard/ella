/**
 * CallButton - Phone icon button for initiating voice calls
 * Shown in conversation header when voice calling is available
 */
import { Phone, Loader2 } from 'lucide-react'
import { cn } from '@ella/ui'
import type { CallState } from '../../hooks/use-voice-call'

export interface CallButtonProps {
  isAvailable: boolean
  isLoading: boolean
  callState: CallState
  onClick: () => void
  label?: string
  className?: string
}

export function CallButton({
  isAvailable,
  isLoading,
  callState,
  onClick,
  label,
  className,
}: CallButtonProps) {
  const isInCall = ['connecting', 'ringing', 'connected', 'disconnecting'].includes(callState)
  const isDisabled = isLoading || !isAvailable || isInCall

  // Don't render if voice not available (after loading)
  if (!isLoading && !isAvailable) {
    return null
  }

  const getAriaLabel = () => {
    if (isLoading) return 'Đang tải...'
    if (isInCall) return 'Đang gọi'
    return 'Gọi điện'
  }

  const getTitle = () => {
    if (isLoading) return 'Đang tải...'
    if (isInCall) return 'Đang trong cuộc gọi'
    return 'Gọi điện cho khách hàng'
  }

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        'flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all duration-200',
        isDisabled
          ? 'text-muted-foreground bg-muted/40 cursor-not-allowed opacity-50'
          : 'text-green-600 dark:text-green-400 hover:bg-green-500/20 active:bg-green-500/30',
        isInCall && 'text-green-500 bg-green-500/20 animate-pulse',
        className
      )}
      aria-label={getAriaLabel()}
      title={getTitle()}
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Phone
          className="w-4 h-4"
          aria-hidden="true"
        />
      )}
      {label && <span>{label}</span>}
    </button>
  )
}
