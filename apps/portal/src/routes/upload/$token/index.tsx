/**
 * Portal Landing Page (/upload/$token)
 * New friendly URL format: /upload/tuyet-nguyen-7k3m
 */
import { createFileRoute } from '@tanstack/react-router'
import { PortalPage } from '../../../components/portal-page'

export const Route = createFileRoute('/upload/$token/')({
  component: () => {
    const { token } = Route.useParams()
    return <PortalPage token={token} />
  },
})
