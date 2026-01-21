/**
 * Toast Container - Portal toast notifications
 * Mobile-first pill design at bottom center with stacking animation
 */
import { Check, X, Info } from 'lucide-react'
import { useToasts, toastStore, type ToastType } from '../lib/toast-store'

const TOAST_ICONS: Record<ToastType, typeof Check> = {
  success: Check,
  error: X,
  info: Info,
}

const TOAST_STYLES: Record<ToastType, string> = {
  success: 'bg-primary text-white',
  error: 'bg-error text-white',
  info: 'bg-foreground text-background',
}

export function ToastContainer() {
  const toasts = useToasts()

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center px-4 w-full max-w-lg"
      aria-live="polite"
    >
      {toasts.map((toast, index) => {
        const Icon = TOAST_ICONS[toast.type]
        // Stack animation: older toasts scale down and fade slightly
        const stackIndex = toasts.length - 1 - index
        const scale = 1 - stackIndex * 0.05
        const opacity = 1 - stackIndex * 0.15

        return (
          <div
            key={toast.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl shadow-lg w-full animate-in fade-in slide-in-from-bottom-4 duration-200 transition-transform ${TOAST_STYLES[toast.type]}`}
            style={{
              transform: `scale(${scale})`,
              opacity: Math.max(opacity, 0.7),
            }}
            role="alert"
          >
            <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <span className="text-sm font-medium flex-1">{toast.message}</span>
            <button
              onClick={() => toastStore.removeToast(toast.id)}
              className="p-1 hover:bg-white/20 rounded-full transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
