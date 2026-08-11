import type { PrismaClient } from '@ella/db'
import { prisma } from '../../lib/db'
import { GoogleDriveServiceError } from './google-drive-errors'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface ClientDrivePermissionTargets {
  accountManagers: Array<{ id: string; name: string; email: string }>
  adminGroupEmail: string | null
  admins: Array<{ id: string; name: string; email: string }>
  clientEmail: string
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function assertEmail(email: string): string {
  const normalized = normalizeEmail(email)
  if (!EMAIL_PATTERN.test(normalized)) {
    throw new GoogleDriveServiceError('DRIVE_PERMISSION_FAILED')
  }
  return normalized
}

export async function resolveClientDrivePermissionTargets(
  input: {
    organizationId: string
    accountManagerStaffIds: string[]
    clientEmail: string
    adminGroupEmail?: string | null
  },
  db: PrismaClient = prisma
): Promise<ClientDrivePermissionTargets> {
  const staffIds = Array.from(new Set(input.accountManagerStaffIds))
  const accountManagers = staffIds.length > 0
    ? await db.staff.findMany({
        where: {
          id: { in: staffIds },
          organizationId: input.organizationId,
          isActive: true,
        },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      })
    : []

  if (accountManagers.length !== staffIds.length) {
    throw new GoogleDriveServiceError('DRIVE_PERMISSION_FAILED', 'Invalid account manager target.')
  }

  const adminGroupEmail = input.adminGroupEmail ? assertEmail(input.adminGroupEmail) : null
  const admins = adminGroupEmail
    ? []
    : await db.staff.findMany({
        where: {
          organizationId: input.organizationId,
          isActive: true,
          role: 'ADMIN',
        },
        select: { id: true, name: true, email: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      })

  return {
    accountManagers: accountManagers.map((staff) => ({
      ...staff,
      email: assertEmail(staff.email),
    })),
    adminGroupEmail,
    admins: admins.map((staff) => ({
      ...staff,
      email: assertEmail(staff.email),
    })),
    clientEmail: assertEmail(input.clientEmail),
  }
}
