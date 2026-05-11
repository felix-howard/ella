import { api } from '../../../lib/api-client'

export function deleteLinkedBusinessClient(businessId: string) {
  if (!businessId) throw new Error('Business client not found')
  return api.clients.delete(businessId)
}
