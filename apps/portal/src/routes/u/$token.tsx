/**
 * Token Layout
 * Layout wrapper for all /u/$token/* routes
 * Renders child routes via Outlet
 */
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/u/$token')({
  component: TokenLayout,
})

function TokenLayout() {
  return <Outlet />
}
