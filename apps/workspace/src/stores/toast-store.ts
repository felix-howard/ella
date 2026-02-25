/**
 * Toast notification wrapper using react-hot-toast
 * Provides consistent API for showing toast notifications
 */
import hotToast from 'react-hot-toast'

// Convenience functions for showing toasts - matches previous API
export const toast = {
  success: (message: string, _duration?: number) =>
    hotToast.success(message, { duration: _duration ?? 3000 }),
  error: (message: string, _duration?: number) =>
    hotToast.error(message, { duration: _duration ?? 4000 }),
  info: (message: string, _duration?: number) =>
    hotToast(message, { duration: _duration ?? 3000 }),
  /** Show persistent loading toast - returns toast ID for dismissal */
  loading: (message: string) =>
    hotToast.loading(message, { duration: Infinity }),
  /** Dismiss a specific toast by ID */
  dismiss: (toastId: string) => hotToast.dismiss(toastId),
}

// Re-export the toast instance for advanced usage
export { hotToast }
