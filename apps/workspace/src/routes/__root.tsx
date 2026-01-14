import { createRootRoute, Outlet } from '@tanstack/react-router'
import { Sidebar, Header } from '../components/layout'
import { ErrorBoundary } from '../components/error-boundary'
import { ToastContainer } from '../components/ui/toast-container'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
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
