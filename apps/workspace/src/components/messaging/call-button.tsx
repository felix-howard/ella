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
  className?: string
}

export function CallButton({
  isAvailable,
  isLoading,
  callState,
  onClick,
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
        'p-2 rounded-lg transition-colors',
        isDisabled
          ? 'text-muted-foreground cursor-not-allowed opacity-50'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted',
        isInCall && 'text-green-500 animate-pulse',
        className
      )}
      aria-label={getAriaLabel()}
      title={getTitle()}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      ) : (
        <Phone
          className={cn('w-4 h-4', isInCall && 'text-green-500')}
          aria-hidden="true"
        />
      )}
    </button>
  )
}
