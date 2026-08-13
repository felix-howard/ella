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
  const sourceEmails = staff.driveEmails && staff.driveEmails.length > 0
    ? staff.driveEmails
    : [staff.email]
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
    db.staff.findMany({
      where: {
        organizationId: input.organizationId,
        isActive: true,
        role: 'MANAGER',
      },
      select: { id: true, name: true, email: true, driveEmails: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }),
  ])

  return {
    accountManagers: expandStaffDriveTargets(accountManagers),
    adminGroupEmail,
    admins: expandStaffDriveTargets(admins),
    clientEmail: assertEmail(input.clientEmail),
  }
}
