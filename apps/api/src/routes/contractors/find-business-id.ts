/**
 * Transition helper: find the legacy Business ID for a BUSINESS-type Client.
 * During transition, Contractor.businessId is still required in the schema.
 * Looks up via ClientGroup → individual Client → Business with matching name.
 * Returns null if no matching Business exists (new BUSINESS client post-migration).
 * Remove in Phase 15 when businessId FK is dropped.
 */
import { prisma } from '../../lib/db'

export async function findBusinessIdForClient(clientId: string): Promise<string | null> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { name: true, clientGroupId: true },
  })
  if (!client?.clientGroupId) return null

  const individualClient = await prisma.client.findFirst({
    where: {
      clientGroupId: client.clientGroupId,
      clientType: 'INDIVIDUAL',
    },
    select: {
      businesses: {
        select: { id: true, name: true },
      },
    },
  })

  if (!individualClient?.businesses.length) return null

  const clientName = client.name.trim().toLowerCase()

  // Exact match first, then case-insensitive fallback
  const exact = individualClient.businesses.find((b) => b.name === client.name)
  if (exact) return exact.id

  const fuzzy = individualClient.businesses.find(
    (b) => b.name.trim().toLowerCase() === clientName
  )
  if (fuzzy) return fuzzy.id

  // If only one business, use it (common case: individual has single business)
  if (individualClient.businesses.length === 1) {
    return individualClient.businesses[0].id
  }

  return null
}
