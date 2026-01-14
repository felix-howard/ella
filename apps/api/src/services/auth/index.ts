/**
 * Auth Service - Clerk integration
 * Phase 3: Authentication System with Clerk
 */
import { prisma } from '../../lib/db'

export interface AuthUser {
  id: string // Clerk user ID
  email: string
  name: string
  role: string
  imageUrl?: string
}

/**
 * Sync Clerk user to Staff table
 * Creates or updates Staff record based on Clerk user data
 */
export async function syncStaffFromClerk(clerkUserId: string, email: string, name: string, imageUrl?: string): Promise<{ role: string } | null> {
  if (!email) return null

  try {
    // Try to find existing staff by clerkId or email
    let staff = await prisma.staff.findFirst({
      where: {
        OR: [{ clerkId: clerkUserId }, { email }],
      },
    })

    if (staff) {
      // Update existing staff with Clerk data
      staff = await prisma.staff.update({
        where: { id: staff.id },
        data: {
          clerkId: clerkUserId,
          name,
          avatarUrl: imageUrl,
          lastLoginAt: new Date(),
        },
      })
    } else {
      // Create new staff from Clerk user
      staff = await prisma.staff.create({
        data: {
          clerkId: clerkUserId,
          email,
          name,
          avatarUrl: imageUrl,
          role: 'STAFF', // Default role, admin can change later
          lastLoginAt: new Date(),
        },
      })
    }

    return { role: staff.role }
  } catch (error) {
    console.error('[Auth] Staff sync failed:', error)
    return null
  }
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
