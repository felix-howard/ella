/**
 * Portal Root Layout
 * Mobile-first minimal layout for client document upload
 */
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { ErrorBoundary } from '../components/error-boundary'

export const Route = createRootRoute({
  component: PortalLayout,
})

function PortalLayout() {
  return (
    <div className="min-h-dvh bg-background">
      {/* Mobile-first container with safe area padding */}
      <div className="mx-auto max-w-lg min-h-dvh flex flex-col">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </div>
    </div>
  )
}
