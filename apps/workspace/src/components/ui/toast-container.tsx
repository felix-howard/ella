/**
 * Toast Container - Renders toast notifications from toast store
 * Positioned at bottom-center of screen with stack layout
 */
import { cn } from '@ella/ui'
import { Check, X, Info } from 'lucide-react'
import { useToastStore, type ToastType } from '../../stores/toast-store'

const TOAST_ICONS: Record<ToastType, typeof Check> = {
  success: Check,
  error: X,
  info: Info,
}

const TOAST_STYLES: Record<ToastType, string> = {
  success: 'bg-success text-white',
  error: 'bg-error text-white',
  info: 'bg-primary text-white',
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center">
      {toasts.map((toast) => {
        const Icon = TOAST_ICONS[toast.type]
        return (
          <div
            key={toast.id}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg',
              'animate-in fade-in slide-in-from-bottom-4 duration-200',
              TOAST_STYLES[toast.type]
            )}
            role="alert"
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-medium whitespace-nowrap">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-0.5 hover:bg-white/20 rounded-full transition-colors ml-1"
              aria-label="Đóng"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
