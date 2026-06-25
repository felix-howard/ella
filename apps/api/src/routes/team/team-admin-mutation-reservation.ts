import { prisma } from '../../lib/db'

const ADMIN_MUTATION_RESERVATION_WINDOW_MS = 5 * 60 * 1000

type StaffAccessRecord = {
  id: string; clerkId: string | null; email: string; name: string; role: string; isActive: boolean
}

type AdminRoleDemotionReservation =
  | {
    success: true
    staff: StaffAccessRecord
    reservedAt: Date
  }
  | {
    success: false
    status: 400 | 404
    body: Record<string, unknown>
  }

export function activeAdminMutationGuard(organizationId: string) {
  return {
    organizationId,
    role: 'ADMIN' as const,
    isActive: true,
    OR: [
      { deactivatedAt: null },
      { deactivatedAt: { lt: new Date(Date.now() - ADMIN_MUTATION_RESERVATION_WINDOW_MS) } },
    ],
  }
}

export async function clearAdminMutationReservation(
  organizationId: string,
  staffId: string,
  reservedAt: Date
) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`team-member-removal:${organizationId}`}))`
    await tx.staff.updateMany({
      where: {
        id: staffId,
        organizationId,
        isActive: true,
        deactivatedAt: reservedAt,
      },
      data: { deactivatedAt: null },
    })
  })
}

export async function reserveAdminRoleDemotion(input: {
  organizationId: string
  staffId: string
}): Promise<AdminRoleDemotionReservation> {
  return prisma.$transaction(async (tx): Promise<AdminRoleDemotionReservation> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`team-member-removal:${input.organizationId}`}))`

    const staff = await tx.staff.findFirst({
      where: { id: input.staffId, organizationId: input.organizationId, isActive: true },
    })

    if (!staff) {
      return { success: false, status: 404, body: { error: 'Staff not found' } }
    }

    const reservedAt = new Date()
    if (staff.role === 'ADMIN') {
      const adminCount = await tx.staff.count({
        where: activeAdminMutationGuard(input.organizationId),
      })
      if (adminCount <= 1) {
        return { success: false, status: 400, body: { error: 'Cannot demote the last admin' } }
      }

      await tx.staff.update({
        where: { id: input.staffId },
        data: { deactivatedAt: reservedAt },
      })
    }

    return { success: true, staff, reservedAt }
  })
}
