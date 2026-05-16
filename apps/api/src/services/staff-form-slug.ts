import type { PrismaClient } from '@ella/db'
import { customAlphabet } from 'nanoid'

const generateDigits = customAlphabet('0123456789', 6)
const MAX_ATTEMPTS = 20

type StaffSlugDb = Pick<PrismaClient, 'staff'>

export async function generateUniqueStaffFormSlug(
  db: StaffSlugDb,
  organizationId: string,
  excludeStaffId?: string
): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const formSlug = generateDigits()
    const existing = await db.staff.findFirst({
      where: {
        organizationId,
        formSlug,
        ...(excludeStaffId ? { id: { not: excludeStaffId } } : {}),
      },
      select: { id: true },
    })

    if (!existing) return formSlug
  }

  throw new Error('Unable to generate unique staff form slug')
}

export async function getStaffFormSlugData(
  db: StaffSlugDb,
  organizationId: string | null | undefined,
  existingStaff?: { id?: string; formSlug?: string | null } | null
): Promise<{ formSlug?: string }> {
  if (!organizationId || existingStaff?.formSlug) return {}

  return {
    formSlug: await generateUniqueStaffFormSlug(db, organizationId, existingStaff?.id),
  }
}
