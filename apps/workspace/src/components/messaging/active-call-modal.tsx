/**
 * ActiveCallModal - Modal overlay displayed during active voice call
 * Shows call status, duration timer, and controls (mute, end)
 * Accessibility: Focus trap, keyboard navigation, aria attributes
 */
import { useEffect, useRef, useCallback } from 'react'
import { Phone, PhoneOff, Mic, MicOff, X } from 'lucide-react'
import { cn } from '@ella/ui'
import type { CallState } from '../../hooks/use-voice-call'

export interface ActiveCallModalProps {
  isOpen: boolean
  callState: CallState
  isMuted: boolean
  duration: number
  clientName: string
  clientPhone: string
  error: string | null
  onEndCall: () => void
  onToggleMute: () => void
  onClose: () => void
}

export function ActiveCallModal({
  isOpen,
  callState,
  isMuted,
  duration,
  clientName,
  clientPhone,
  error,
  onEndCall,
  onToggleMute,
  onClose,
}: ActiveCallModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Get all focusable elements in modal
  const getFocusableElements = useCallback(() => {
    if (!modalRef.current) return []
    return Array.from(
      modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    )
  }, [])

  // Focus trap - trap focus within modal
  useEffect(() => {
    if (!isOpen) return

    // Save previously focused element
    previousFocusRef.current = document.activeElement as HTMLElement

    // Focus first element in modal
    const focusableElements = getFocusableElements()
    if (focusableElements.length > 0) {
      focusableElements[0].focus()
    }

    // Handle Tab key for focus trap
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Tab') {
        const focusable = getFocusableElements()
        if (focusable.length === 0) return

        const firstElement = focusable[0]
        const lastElement = focusable[focusable.length - 1]

        if (e.shiftKey) {
          // Shift+Tab: if on first element, go to last
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement.focus()
          }
        } else {
          // Tab: if on last element, go to first
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement.focus()
          }
        }
      }

      // Escape to close (only when idle or error)
      if (e.key === 'Escape' && (callState === 'idle' || callState === 'error')) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    // Cleanup: restore focus to previous element
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus()
      }
    }
  }, [isOpen, callState, onClose, getFocusableElements])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getStatusText = (): string => {
    switch (callState) {
      case 'connecting':
        return 'Đang kết nối...'
      case 'ringing':
        return 'Đang đổ chuông...'
      case 'connected':
        return 'Đang gọi'
      case 'disconnecting':
        return 'Đang kết thúc...'
      case 'error':
        return error || 'Lỗi cuộc gọi'
      default:
        return 'Cuộc gọi kết thúc'
    }
  }

  const canEndCall = ['connecting', 'ringing', 'connected'].includes(callState)
  const canMute = callState === 'connected'
  const showTimer = callState === 'connected'
  const showClose = callState === 'idle' || callState === 'error'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="call-modal-title"
      aria-describedby="call-modal-status"
    >
      <div
        ref={modalRef}
        className="bg-card rounded-2xl shadow-xl w-80 max-w-[90vw] overflow-hidden relative"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 p-6 text-center text-primary-foreground">
          {showClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/20 transition-colors"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-white/20 flex items-center justify-center">
            <Phone className="w-8 h-8" aria-hidden="true" />
          </div>

          <h2 id="call-modal-title" className="text-lg font-semibold truncate">
            {clientName}
          </h2>
          <p className="text-sm opacity-80">{clientPhone}</p>
        </div>

        {/* Status & Timer */}
        <div className="p-6 text-center">
          <p
            id="call-modal-status"
            className={cn(
              'text-sm font-medium mb-2',
              callState === 'error' ? 'text-destructive' : 'text-muted-foreground'
            )}
            role="status"
            aria-live="polite"
          >
            {getStatusText()}
          </p>

          {showTimer && (
            <p
              className="text-3xl font-mono font-bold text-foreground"
              aria-label={`Thời gian gọi: ${formatDuration(duration)}`}
            >
              {formatDuration(duration)}
            </p>
          )}

          {callState === 'error' && error && (
            <p className="text-sm text-destructive mt-2" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-border flex justify-center gap-4">
          {canMute && (
            <button
              onClick={onToggleMute}
              className={cn(
                'w-14 h-14 rounded-full flex items-center justify-center transition-colors',
                isMuted
                  ? 'bg-yellow-500 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
              aria-label={isMuted ? 'Bật mic' : 'Tắt mic'}
              aria-pressed={isMuted}
              title={isMuted ? 'Bật mic' : 'Tắt mic'}
            >
              {isMuted ? <MicOff className="w-6 h-6" aria-hidden="true" /> : <Mic className="w-6 h-6" aria-hidden="true" />}
            </button>
          )}

          {canEndCall && (
            <button
              onClick={onEndCall}
              className="w-14 h-14 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 transition-colors"
              aria-label="Kết thúc cuộc gọi"
              title="Kết thúc cuộc gọi"
            >
              <PhoneOff className="w-6 h-6" aria-hidden="true" />
            </button>
          )}

          {showClose && (
            <button
              onClick={onClose}
              className="w-14 h-14 rounded-full bg-muted text-muted-foreground flex items-center justify-center hover:bg-muted/80 transition-colors"
              aria-label="Đóng"
            >
              <X className="w-6 h-6" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
