import { useQuery } from '@tanstack/react-query'
import { api } from '../../../lib/api-client'
import { assertClientPaidServicesResponse } from './paid-services-response-guard'

export function useClientPaidServices(clientId: string) {
  return useQuery({
    queryKey: ['client-paid-services', clientId],
    queryFn: async () => {
      const response: unknown = await api.clients.paidServices.list(clientId)
      assertClientPaidServicesResponse(response)
      return response
    },
    enabled: Boolean(clientId),
  })
}
