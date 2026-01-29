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
          background: '#1E293B',
          color: '#F1F5F9',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        },
        success: {
          duration: 3000,
          style: {
            background: '#059669',
            color: 'white',
          },
          iconTheme: {
            primary: 'white',
            secondary: '#059669',
          },
        },
        error: {
          duration: 4000,
          style: {
            background: '#EF4444',
            color: 'white',
          },
          iconTheme: {
            primary: 'white',
            secondary: '#EF4444',
          },
        },
      }}
    />
  )
}
