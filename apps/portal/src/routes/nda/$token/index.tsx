/**
 * Legacy alias for the agreement signing page.
 * URL: /nda/:token  (kept forever — existing customer SMS links use this path)
 *
 * Renders the same `AgreementSignPage` component as `/agreements/:token`. The
 * portal API client always calls `/public/agreements/...`, which the API mounts
 * dual-aliased so historical link traffic resolves regardless of which URL the
 * customer's SMS happens to contain.
 */
import { createFileRoute } from '@tanstack/react-router'
import { AgreementSignPage } from '../../../components/agreements/agreement-sign-page'

export const Route = createFileRoute('/nda/$token/')({
  component: NdaTokenRouteComponent,
})

function NdaTokenRouteComponent() {
  const { token } = Route.useParams()
  return <AgreementSignPage token={token} />
}
