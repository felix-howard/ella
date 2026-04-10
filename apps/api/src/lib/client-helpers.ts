/**
 * Client helper utilities
 * Shared business logic for client-group operations
 */
import { prisma } from './db'

/**
 * Check if a client is a business linked to a group (with an individual owner).
 * Business clients in a group should share the individual's conversation/portal.
 */
export function isBizWithGroup(client: { clientType: string; clientGroupId?: string | null }): boolean {
  return client.clientType === 'BUSINESS' && !!client.clientGroupId
}

/**
 * Find the individual owner in a client group.
 * Uses createdAt desc ordering — in current data model, each group has exactly one individual.
 * If multiple individuals exist (not supported today), the most recently created one is used.
 */
export async function findGroupIndividual(
  clientGroupId: string,
  organizationId?: string,
) {
  return prisma.client.findFirst({
    where: {
      clientGroupId,
      clientType: 'INDIVIDUAL',
      ...(organizationId ? { organizationId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      phone: true,
      name: true,
      language: true,
      taxCases: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, taxYear: true },
      },
    },
  })
}
