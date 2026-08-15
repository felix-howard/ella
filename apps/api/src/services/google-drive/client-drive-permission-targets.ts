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

function resolveStaffDriveEmails(staff: { email: string; driveEmails?: string[] | null }): string[] {
  const sourceEmails = [staff.email, ...(staff.driveEmails ?? [])]
  return Array.from(new Set(sourceEmails.map(assertEmail)))
}

function expandStaffDriveTargets(staffRows: Array<{
  id: string
  name: string
  email: string
  driveEmails?: string[] | null
}>): Array<{ id: string; name: string; email: string }> {
  return staffRows.flatMap((staff) =>
    resolveStaffDriveEmails(staff).map((email) => ({
      id: staff.id,
      name: staff.name,
      email,
    }))
  )
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
  const adminGroupEmail = input.adminGroupEmail ? assertEmail(input.adminGroupEmail) : null
  const accountManagerStaffIds = Array.from(new Set(input.accountManagerStaffIds))
  const [admins, accountManagers] = await Promise.all([
    db.staff.findMany({
      where: {
        organizationId: input.organizationId,
        isActive: true,
        role: 'ADMIN',
      },
      select: { id: true, name: true, email: true, driveEmails: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }),
    // Only the account managers explicitly assigned to this client get AM WORK
    // access — scope by their staff ids, never every manager in the org.
    accountManagerStaffIds.length > 0
      ? db.staff.findMany({
          where: {
            organizationId: input.organizationId,
            isActive: true,
            id: { in: accountManagerStaffIds },
          },
          select: { id: true, name: true, email: true, driveEmails: true },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        })
      : Promise.resolve([]),
  ])

  return {
    accountManagers: expandStaffDriveTargets(accountManagers),
    adminGroupEmail,
    admins: expandStaffDriveTargets(admins),
    clientEmail: assertEmail(input.clientEmail),
  }
}
