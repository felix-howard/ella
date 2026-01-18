import { createRootRoute, Outlet, useRouterState, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@clerk/clerk-react'
import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Sidebar, Header } from '../components/layout'
import { ErrorBoundary } from '../components/error-boundary'
import { ToastContainer } from '../components/ui/toast-container'
import { useTheme } from '../stores/ui-store'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const { isSignedIn, isLoaded } = useAuth()
  const routerState = useRouterState()
  const navigate = useNavigate()
  const isLoginPage = routerState.location.pathname === '/login'
  const { theme } = useTheme()

  // Apply theme class on mount and when theme changes
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  useEffect(() => {
    if (isLoaded && !isSignedIn && !isLoginPage) {
      navigate({ to: '/login' })
    }
  }, [isLoaded, isSignedIn, isLoginPage, navigate])

  // Show loading spinner while checking auth
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  // Show login page without sidebar/header
  if (!isSignedIn || isLoginPage) {
    return (
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    )
  }

  // Show main app layout for authenticated users
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <Header />
        <Outlet />
        <ToastContainer />
      </div>
    </ErrorBoundary>
  )
}
