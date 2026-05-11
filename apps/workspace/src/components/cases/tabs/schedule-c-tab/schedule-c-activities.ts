import type { ClientPreview } from '../../../../lib/api-client'
import { isScheduleCEligibleBusiness } from '../../../../lib/business-type-helpers'

export function getLinkedBusinessesWithScheduleC(clients: ClientPreview[] | null | undefined): ClientPreview[] {
  return (clients ?? []).filter(
    (client) =>
      isScheduleCEligibleBusiness(client) &&
      client.scheduleCExpense != null
  )
}
