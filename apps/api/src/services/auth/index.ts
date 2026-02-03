/**
 * Auth Service - Clerk integration
 * Phase 3: Authentication System with Clerk
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

// In-memory cache for org ID mapping (clerkOrgId -> DB id), TTL 5 min
const orgCache = new Map<string, { id: string; expiresAt: number }>()
const ORG_CACHE_TTL_MS = 5 * 60 * 1000

/**
 * Sync Clerk Organization to DB Organization table
 * Uses in-memory cache to avoid DB upsert on every request
 */
export async function syncOrganization(
  clerkOrgId: string,
  name?: string,
  slug?: string,
  logoUrl?: string
): Promise<{ id: string }> {
  // Check cache first
  const cached = orgCache.get(clerkOrgId)
  if (cached && cached.expiresAt > Date.now()) {
    return { id: cached.id }
  }

  const org = await prisma.organization.upsert({
    where: { clerkOrgId },
    update: { name: name || undefined, slug, logoUrl },
    create: { clerkOrgId, name: name || 'My Organization', slug, logoUrl },
    select: { id: true },
  })

  orgCache.set(clerkOrgId, { id: org.id, expiresAt: Date.now() + ORG_CACHE_TTL_MS })
  return org
}

/**
 * Map Clerk org role to DB StaffRole
 * org:admin -> ADMIN, everything else -> STAFF
 */
function mapClerkRoleToStaffRole(clerkOrgRole?: string | null): 'ADMIN' | 'STAFF' {
  return clerkOrgRole === 'org:admin' ? 'ADMIN' : 'STAFF'
}

/**
 * Sync Clerk user to Staff table
 * Creates or updates Staff record based on Clerk user data
 * Syncs role from Clerk org role (org:admin -> ADMIN, org:member -> STAFF)
 */
export async function syncStaffFromClerk(
  clerkUserId: string,
  email: string,
  name: string,
  imageUrl?: string,
  organizationId?: string,
  clerkOrgRole?: string | null
): Promise<{ role: string } | null> {
  if (!email) return null

  const role = mapClerkRoleToStaffRole(clerkOrgRole)

  try {
    // Try to find by email first (staff may exist before Clerk link)
    const existingByEmail = await prisma.staff.findUnique({ where: { email } })

    if (existingByEmail) {
      // Link existing email-based staff to Clerk and update
      const staff = await prisma.staff.update({
        where: { id: existingByEmail.id },
        data: {
          clerkId: clerkUserId,
          name,
          role,
          avatarUrl: imageUrl,
          lastLoginAt: new Date(),
          organizationId: organizationId || undefined,
        },
      })
      return { role: staff.role }
    }

    // Atomic upsert by clerkId to prevent race condition on concurrent requests
    const staff = await prisma.staff.upsert({
      where: { clerkId: clerkUserId },
      update: {
        name,
        role,
        avatarUrl: imageUrl,
        lastLoginAt: new Date(),
        organizationId: organizationId || undefined,
      },
      create: {
        clerkId: clerkUserId,
        email,
        name,
        avatarUrl: imageUrl,
        role,
        lastLoginAt: new Date(),
        organizationId: organizationId || undefined,
      },
    })

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
