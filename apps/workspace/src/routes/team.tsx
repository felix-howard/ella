/**
 * Team Layout Route - Parent layout for team-related pages
 * Renders child routes via Outlet
 */
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/team')({
  component: TeamLayout,
})

function TeamLayout() {
  return <Outlet />
}
