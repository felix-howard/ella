/**
 * Expense Token Layout
 * Wrapper for expense form route with token validation
 */
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/expense/$token')({
  component: ExpenseTokenLayout,
})

function ExpenseTokenLayout() {
  return <Outlet />
}
