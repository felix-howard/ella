/**
 * Public sent pricing-quote pay route.
 * URL: /quote/:payToken (?status=success|canceled set by Stripe return URLs)
 * SMS'd to a Client/Lead when an admin sends them a calculated quote.
 */
import { createFileRoute } from '@tanstack/react-router'
import { QuotePayPage } from '../../../components/payments/quote-pay-page'

interface QuotePageSearch {
  status?: 'success' | 'canceled'
}

export const Route = createFileRoute('/quote/$payToken/')({
  validateSearch: (search: Record<string, unknown>): QuotePageSearch => ({
    status: search.status === 'success' || search.status === 'canceled' ? search.status : undefined,
  }),
  component: QuoteTokenRouteComponent,
})

function QuoteTokenRouteComponent() {
  const { payToken } = Route.useParams()
  const { status } = Route.useSearch()
  return <QuotePayPage payToken={payToken} returnStatus={status} />
}
