/**
 * Canonical agreement signing route.
 * URL: /agreements/:token
 * Backed by the shared `AgreementSignPage` component, which is also mounted at
 * the legacy `/nda/:token` alias for back-compat with existing customer SMS.
 */
import { createFileRoute } from '@tanstack/react-router'
import { AgreementSignPage } from '../../../components/agreements/agreement-sign-page'

export const Route = createFileRoute('/agreements/$token/')({
  component: AgreementsTokenRouteComponent,
})

function AgreementsTokenRouteComponent() {
  const { token } = Route.useParams()
  return <AgreementSignPage token={token} />
}
