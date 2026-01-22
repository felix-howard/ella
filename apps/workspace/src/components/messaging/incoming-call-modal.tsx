/**
 * IncomingCallModal - Modal overlay for incoming voice calls
 * Shows caller info with accept/reject buttons
 * Features: Ring animation, accessibility, focus trap
 */
import { useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Phone, PhoneOff, PhoneIncoming, User } from 'lucide-react'
import { cn } from '@ella/ui'
import type { CallerInfo } from '../../hooks/use-voice-call'
import type { TwilioCall } from '../../lib/twilio-sdk-loader'

export interface IncomingCallModalProps {
  call: TwilioCall | null
  callerInfo: CallerInfo | null
  onAccept: () => void
  onReject: () => void
}

export function IncomingCallModal({
  call,
  callerInfo,
  onAccept,
  onReject,
}: IncomingCallModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Get all focusable elements in modal
  const getFocusableElements = useCallback(() => {
    if (!modalRef.current) return []
    return Array.from(
      modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      )
    )
  }, [])

  // Focus trap
  useEffect(() => {
    if (!call) return

    // Save previously focused element
    previousFocusRef.current = document.activeElement as HTMLElement

    // Focus accept button (more accessible default)
    const focusableElements = getFocusableElements()
    const acceptButton = focusableElements.find((el) => el.getAttribute('aria-label')?.includes('Chấp'))
    if (acceptButton) {
      acceptButton.focus()
    } else if (focusableElements.length > 0) {
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
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus()
      }
    }
  }, [call, getFocusableElements])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (call) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [call])

  if (!call) return null

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="incoming-call-title"
      aria-describedby="incoming-call-desc"
    >
      <div
        ref={modalRef}
        className={cn(
          'bg-card rounded-2xl shadow-2xl w-80 max-w-[90vw] overflow-hidden',
          'animate-in fade-in zoom-in-95 duration-200'
        )}
      >
        {/* Header with ring animation */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-center text-white">
          {/* Animated ring effect */}
          <div className="relative w-20 h-20 mx-auto mb-4">
            {/* Pulsing ring effect */}
            <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
            <div
              className="absolute inset-0 rounded-full bg-white/30 animate-pulse"
              style={{ animationDelay: '0.3s' }}
            />
            {/* Icon container */}
            <div className="relative w-full h-full rounded-full bg-white/20 flex items-center justify-center">
              {callerInfo?.clientName ? (
                <User className="w-10 h-10" aria-hidden="true" />
              ) : (
                <PhoneIncoming className="w-10 h-10" aria-hidden="true" />
              )}
            </div>
          </div>

          <h2 id="incoming-call-title" className="text-lg font-semibold truncate">
            {callerInfo?.clientName || 'Khách hàng mới'}
          </h2>
          <p className="text-sm opacity-90">{callerInfo?.phone || 'Số điện thoại không xác định'}</p>
          {callerInfo?.caseId && (
            <p className="text-xs opacity-75 mt-1">
              Mã hồ sơ: #{callerInfo.caseId.slice(-6).toUpperCase()}
            </p>
          )}
        </div>

        {/* Status */}
        <div className="p-4 text-center">
          <p
            id="incoming-call-desc"
            className="text-sm text-muted-foreground animate-pulse"
            role="status"
            aria-live="polite"
          >
            Cuộc gọi đến...
          </p>
        </div>

        {/* Accept/Reject buttons */}
        <div className="p-4 border-t border-border flex justify-center gap-6">
          <button
            onClick={onReject}
            className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center transition-all',
              'bg-red-500 text-white hover:bg-red-600',
              'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
              'active:scale-95'
            )}
            aria-label="Từ chối cuộc gọi"
            title="Từ chối - Chuyển sang thư thoại"
          >
            <PhoneOff className="w-7 h-7" aria-hidden="true" />
          </button>

          <button
            onClick={onAccept}
            className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center transition-all',
              'bg-green-500 text-white hover:bg-green-600',
              'focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2',
              'active:scale-95 animate-bounce'
            )}
            aria-label="Chấp nhận cuộc gọi"
            title="Chấp nhận cuộc gọi"
          >
            <Phone className="w-7 h-7" aria-hidden="true" />
          </button>
        </div>

        {/* Help text */}
        <div className="px-4 pb-4 text-center">
          <p className="text-xs text-muted-foreground">
            Từ chối sẽ chuyển cuộc gọi sang thư thoại
          </p>
        </div>
      </div>
    </div>
  )

  // Render in portal to ensure it's above everything
  return createPortal(modalContent, document.body)
}
