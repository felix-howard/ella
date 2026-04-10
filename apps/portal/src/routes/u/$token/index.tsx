/**
 * Legacy Portal Landing Page (/u/$token)
 * Kept for backward compatibility with existing links
 */
import { createFileRoute } from '@tanstack/react-router'
import { PortalPage } from '../../../components/portal-page'

function LegacyPortalRoute() {
  const { token } = Route.useParams()
  return <PortalPage token={token} />
}

export const Route = createFileRoute('/u/$token/')({
  component: LegacyPortalRoute,
})
