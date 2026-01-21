/**
 * Portal Toast Store - Lightweight toast notifications
 * Uses useSyncExternalStore pattern (no zustand dependency)
 * Supports success, error, info types with auto-dismiss
 * Features: deduplication, max 3 visible, SSR-safe
 */
import { useSyncExternalStore } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
}

// Constants
const MAX_VISIBLE_TOASTS = 3
const DEDUP_WINDOW_MS = 500

// Internal state
let toasts: Toast[] = []
const listeners = new Set<() => void>()
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
const recentMessages = new Map<string, number>() // message -> timestamp for dedup

// Notify all subscribers
function emitChange() {
  listeners.forEach((listener) => listener())
}

// Generate unique toast ID
function generateId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// Check for duplicate message within dedup window
function isDuplicate(message: string, type: ToastType): boolean {
  const key = `${type}:${message}`
  const lastTime = recentMessages.get(key)
  const now = Date.now()

  if (lastTime && now - lastTime < DEDUP_WINDOW_MS) {
    return true
  }

  recentMessages.set(key, now)
  // Clean old entries
  recentMessages.forEach((time, k) => {
    if (now - time > DEDUP_WINDOW_MS) {
      recentMessages.delete(k)
    }
  })

  return false
}

// Store API
export const toastStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  getSnapshot() {
    return toasts
  },

  // SSR-safe: return empty array on server
  getServerSnapshot() {
    return [] as Toast[]
  },

  addToast(newToast: Omit<Toast, 'id'>) {
    // Skip duplicate messages within dedup window
    if (isDuplicate(newToast.message, newToast.type)) {
      return ''
    }

    const id = generateId()
    const duration = newToast.duration ?? 3000

    // Add new toast and enforce max limit (keep newest)
    toasts = [...toasts, { ...newToast, id }].slice(-MAX_VISIBLE_TOASTS)
    emitChange()

    // Auto-dismiss
    if (duration > 0) {
      const timeoutId = setTimeout(() => {
        toastTimeouts.delete(id)
        toastStore.removeToast(id)
      }, duration)
      toastTimeouts.set(id, timeoutId)
    }

    return id
  },

  removeToast(id: string) {
    // Clear timeout on manual dismiss
    const timeoutId = toastTimeouts.get(id)
    if (timeoutId) {
      clearTimeout(timeoutId)
      toastTimeouts.delete(id)
    }
    toasts = toasts.filter((t) => t.id !== id)
    emitChange()
  },
}

// React hook to subscribe to toast state (SSR-safe)
export function useToasts() {
  return useSyncExternalStore(
    toastStore.subscribe,
    toastStore.getSnapshot,
    toastStore.getServerSnapshot
  )
}

// Convenience functions
export const toast = {
  success: (message: string, duration?: number) =>
    toastStore.addToast({ message, type: 'success', duration }),
  error: (message: string, duration?: number) =>
    toastStore.addToast({ message, type: 'error', duration: duration ?? 5000 }),
  info: (message: string, duration?: number) =>
    toastStore.addToast({ message, type: 'info', duration }),
}
