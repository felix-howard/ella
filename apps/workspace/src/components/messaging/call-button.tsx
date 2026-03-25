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
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border',
        isDisabled
          ? 'text-muted-foreground border-transparent cursor-not-allowed opacity-50'
          : 'text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted/60 hover:border-border',
        isInCall && 'text-green-500 border-green-300 animate-pulse',
        className
      )}
      aria-label={getAriaLabel()}
      title={getTitle()}
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Phone
          className={cn('w-3.5 h-3.5', isInCall && 'text-green-500')}
          aria-hidden="true"
        />
      )}
      {label && <span>{label}</span>}
    </button>
  )
}
