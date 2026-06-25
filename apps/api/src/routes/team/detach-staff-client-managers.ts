import type { Prisma } from '@ella/db'

export type DetachedClientAssignments = {
  detachedClientManagerCount: number
  updatedPrimaryClientCount: number
}

export async function detachStaffFromCurrentClientManagers(
  tx: Prisma.TransactionClient,
  organizationId: string,
  staffId: string
): Promise<DetachedClientAssignments> {
  const affectedClients = await tx.client.findMany({
    where: {
      organizationId,
      OR: [{ managedById: staffId }, { managers: { some: { staffId } } }],
    },
    select: { id: true, managedById: true },
  })

  if (affectedClients.length === 0) {
    return { detachedClientManagerCount: 0, updatedPrimaryClientCount: 0 }
  }

  const affectedClientIds = affectedClients.map((client) => client.id)
  const deleted = await tx.clientManager.deleteMany({
    where: {
      organizationId,
      staffId,
      clientId: { in: affectedClientIds },
    },
  })

  const remainingManagers = await tx.clientManager.findMany({
    where: {
      organizationId,
      clientId: { in: affectedClientIds },
    },
    orderBy: [{ clientId: 'asc' }, { createdAt: 'asc' }],
    select: { clientId: true, staffId: true },
  })

  const nextPrimaryByClientId = new Map<string, string>()
  for (const manager of remainingManagers) {
    if (!nextPrimaryByClientId.has(manager.clientId)) {
      nextPrimaryByClientId.set(manager.clientId, manager.staffId)
    }
  }

  let updatedPrimaryClientCount = 0
  for (const client of affectedClients) {
    if (client.managedById !== staffId) continue

    const updated = await tx.client.updateMany({
      where: { id: client.id, organizationId },
      data: { managedById: nextPrimaryByClientId.get(client.id) ?? null },
    })
    updatedPrimaryClientCount += updated.count
  }

  return {
    detachedClientManagerCount: deleted.count,
    updatedPrimaryClientCount,
  }
}
