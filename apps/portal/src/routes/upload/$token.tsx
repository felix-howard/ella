/**
 * Upload Token Layout
 * Layout wrapper for /upload/$token routes (friendly URL format)
 */
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/upload/$token')({
  component: UploadTokenLayout,
})

function UploadTokenLayout() {
  return <Outlet />
}
