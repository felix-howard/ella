/**
 * Query hook for a client's payments list — shared by the Payments tab and
 * the Overview payments summary card (same cache key keeps them in sync).
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../lib/api-client'

export function useClientPayments(clientId: string, enabled = true) {
  return useQuery({
    queryKey: ['client-payments', clientId],
    queryFn: () => api.clients.payments.list(clientId),
    enabled,
  })
}
