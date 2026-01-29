/**
 * Toast Container - Uses react-hot-toast for notifications
 * Positioned at bottom-right of screen
 */
import { Toaster } from 'react-hot-toast'

export function ToastContainer() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 3000,
        style: {
          borderRadius: '9999px',
          padding: '10px 16px',
          fontSize: '14px',
          fontWeight: 500,
          background: 'hsl(222 47% 16%)',
          color: 'white',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        },
        success: {
          duration: 3000,
          style: {
            background: 'hsl(var(--success))',
            color: 'white',
          },
          iconTheme: {
            primary: 'white',
            secondary: 'hsl(var(--success))',
          },
        },
        error: {
          duration: 4000,
          style: {
            background: 'hsl(var(--error))',
            color: 'white',
          },
          iconTheme: {
            primary: 'white',
            secondary: 'hsl(var(--error))',
          },
        },
      }}
    />
  )
}
