import type { Prisma } from '@ella/db'
import { resolveAvatarUrl } from '../storage'

type StaffSummary = {
  id: string
  name: string
  avatarUrl: string | null
  isActive?: boolean
}

type ClientManagerLink = {
  staff: StaffSummary
}

export type ClientManagerDto = {
  id: string
  name: string
  avatarUrl: string | null
  isActive?: boolean
}

export function normalizeManagerIds(input: {
  staffId?: string | null
  staffIds?: string[]
}): string[] {
  const ids = input.staffIds ?? (input.staffId ? [input.staffId] : [])
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))))
}

export async function validateActiveOrgStaff(
  tx: Prisma.TransactionClient,
  organizationId: string,
  staffIds: string[]
): Promise<boolean> {
  if (staffIds.length === 0) return true

  const staff = await tx.staff.findMany({
    where: {
      id: { in: staffIds },
      organizationId,
      isActive: true,
    },
    select: { id: true },
  })

  return staff.length === staffIds.length
}

export async function syncClientManagers(
  tx: Prisma.TransactionClient,
  input: {
    clientIds: string[]
    organizationId: string
    staffIds: string[]
  }
) {
  const clientIds = Array.from(new Set(input.clientIds))
  if (clientIds.length === 0) return

  const primaryManagerId = input.staffIds[0] ?? null

  await tx.client.updateMany({
    where: {
      id: { in: clientIds },
      organizationId: input.organizationId,
    },
    data: { managedById: primaryManagerId },
  })

  await tx.clientManager.deleteMany({
    where: {
      clientId: { in: clientIds },
      organizationId: input.organizationId,
      ...(input.staffIds.length > 0 ? { staffId: { notIn: input.staffIds } } : {}),
    },
  })

  if (input.staffIds.length === 0) return

  await tx.clientManager.createMany({
    data: clientIds.flatMap((clientId) =>
      input.staffIds.map((staffId) => ({
        clientId,
        staffId,
        organizationId: input.organizationId,
      }))
    ),
    skipDuplicates: true,
  })
}

export async function mapClientManagerDtos(
  managers: ClientManagerLink[],
  legacyManagedBy?: StaffSummary | null
): Promise<ClientManagerDto[]> {
  const byId = new Map<string, StaffSummary>()
  const orderedStaff: StaffSummary[] = []

  if (legacyManagedBy) {
    byId.set(legacyManagedBy.id, legacyManagedBy)
    orderedStaff.push(legacyManagedBy)
  }

  for (const manager of managers) {
    if (byId.has(manager.staff.id)) continue
    byId.set(manager.staff.id, manager.staff)
    orderedStaff.push(manager.staff)
  }

  return Promise.all(
    orderedStaff.map(async (staff) => ({
      id: staff.id,
      name: staff.name,
      avatarUrl: await resolveAvatarUrl(staff.avatarUrl),
      isActive: staff.isActive,
    }))
  )
}

export function getPrimaryManager(
  managers: ClientManagerDto[]
): ClientManagerDto | null {
  return managers[0] ?? null
}

export function orderManagerIdsWithPrimary(
  managerIds: string[],
  primaryManagerId?: string | null
): string[] {
  const orderedIds = primaryManagerId ? [primaryManagerId, ...managerIds] : managerIds
  return Array.from(new Set(orderedIds.filter((id): id is string => Boolean(id))))
}
