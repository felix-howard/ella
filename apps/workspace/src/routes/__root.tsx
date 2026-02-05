import { createRootRoute, Outlet, useRouterState, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@clerk/clerk-react'
import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Sidebar, Header } from '../components/layout'
import { ErrorBoundary } from '../components/error-boundary'
import { ToastContainer } from '../components/ui/toast-container'
import { VoiceCallProvider } from '../components/voice'
import { useTheme } from '../stores/ui-store'
import { useLanguageSync } from '../hooks/use-language-sync'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const { isSignedIn, isLoaded } = useAuth()
  const routerState = useRouterState()
  const navigate = useNavigate()
  const pathname = routerState.location.pathname
  const isPublicPage = pathname === '/login' || pathname === '/accept-invitation'
  const { theme } = useTheme()

  // Sync language preference from DB (runs only when signed in)
  useLanguageSync()

  // Apply theme class on mount and when theme changes
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  useEffect(() => {
    if (isLoaded && !isSignedIn && !isPublicPage) {
      navigate({ to: '/login' })
    }
  }, [isLoaded, isSignedIn, isPublicPage, navigate])

  // Show loading spinner while checking auth
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  // Not signed in and not on login page - show loading while redirecting
  // This prevents protected routes from rendering and making API calls
  if (!isSignedIn && !isPublicPage) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  // Show login page without sidebar/header
  if (isPublicPage) {
    return (
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    )
  }

  // Show main app layout for authenticated users
  return (
    <ErrorBoundary>
      <VoiceCallProvider>
        <div className="min-h-screen bg-background">
          <Sidebar />
          <Header />
          <Outlet />
          <ToastContainer />
        </div>
      </VoiceCallProvider>
    </ErrorBoundary>
  )
}
