/**
 * Toast notification store - Zustand store for toast notifications
 * Supports success, error, and info toast types with auto-dismiss
 * Handles cleanup to prevent memory leaks
 */
import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastState {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  clearToasts: () => void
}

// Track timeouts for cleanup on manual dismiss
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

function generateToastId(): string {
  // Use crypto.randomUUID if available, fallback to timestamp + random
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `toast-${crypto.randomUUID()}`
  }
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = generateToastId()
    const duration = toast.duration ?? 2000

    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }))

    // Auto-remove after duration with cleanup tracking
    if (duration > 0) {
      const timeoutId = setTimeout(() => {
        toastTimeouts.delete(id)
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }))
      }, duration)
      toastTimeouts.set(id, timeoutId)
    }
  },

  removeToast: (id) => {
    // Clear timeout to prevent memory leak on manual dismiss
    const timeoutId = toastTimeouts.get(id)
    if (timeoutId) {
      clearTimeout(timeoutId)
      toastTimeouts.delete(id)
    }
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },

  clearToasts: () => {
    // Clear all timeouts on clear
    toastTimeouts.forEach((timeoutId) => clearTimeout(timeoutId))
    toastTimeouts.clear()
    set({ toasts: [] })
  },
}))

// Convenience functions for showing toasts
export const toast = {
  success: (message: string, duration?: number) =>
    useToastStore.getState().addToast({ message, type: 'success', duration }),
  error: (message: string, duration?: number) =>
    useToastStore.getState().addToast({ message, type: 'error', duration }),
  info: (message: string, duration?: number) =>
    useToastStore.getState().addToast({ message, type: 'info', duration }),
}
