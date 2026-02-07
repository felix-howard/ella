/**
 * Rental Token Layout
 * Wrapper for rental form route with token validation
 */
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/rental/$token')({
  component: RentalTokenLayout,
})

function RentalTokenLayout() {
  return <Outlet />
}
