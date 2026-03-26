/**
 * Auth Service - Clerk integration
 * Sync handled by webhooks (see services/clerk-webhook)
 */
import { prisma } from '../../lib/db'

export interface AuthUser {
  id: string // Clerk user ID
  staffId: string | null // Staff table ID (for foreign keys)
  email: string
  name: string
  role: string
  imageUrl?: string
  // Organization context from Clerk JWT
  organizationId: string | null // DB Organization.id
  clerkOrgId: string | null // Clerk org ID (org_xxx)
  orgRole: string | null // 'org:admin' | 'org:member'
}

/**
 * Get staff by Clerk ID
 */
export async function getStaffByClerkId(clerkId: string) {
  return prisma.staff.findUnique({
    where: { clerkId },
  })
}

/**
 * Update staff role (admin only)
 */
export async function updateStaffRole(
  staffId: string,
  role: 'ADMIN' | 'STAFF' | 'CPA'
) {
  return prisma.staff.update({
    where: { id: staffId },
    data: { role },
  })
}

/**
 * Deactivate staff member
 */
export async function deactivateStaff(staffId: string) {
  return prisma.staff.update({
    where: { id: staffId },
    data: {
      isActive: false,
      deactivatedAt: new Date(),
    },
  })
}
