/**
 * Auth Service - Clerk integration
 * Webhooks handle normal sync; auth middleware can bootstrap pending memberships.
 */
import type { Prisma } from '@ella/db'
import { prisma } from '../../lib/db'
import { clerkClient } from '../../lib/clerk-client'

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

type StaffWithOrganization = Prisma.StaffGetPayload<{ include: { organization: true } }>

function mapClerkRole(clerkRole: string | null | undefined): 'ADMIN' | 'STAFF' {
  return clerkRole === 'org:admin' ? 'ADMIN' : 'STAFF'
}

function buildName(firstName: string | null | undefined, lastName: string | null | undefined): string {
  return [firstName, lastName].filter(Boolean).join(' ') || 'Unknown'
}

async function getClerkUserFallback(clerkId: string) {
  try {
    return await clerkClient.users.getUser(clerkId)
  } catch (error) {
    console.warn(`[Auth] Failed to fetch Clerk user fallback for ${clerkId}:`, error)
    return null
  }
}

/**
 * Bootstrap or refresh Staff from the active Clerk organization membership.
 * Webhooks remain the primary sync path; this covers invite-accept races and local
 * development where Clerk cannot post webhooks to localhost.
 */
export async function syncStaffFromClerkMembership(
  clerkId: string,
  clerkOrgId: string | null,
  orgRole?: string | null
): Promise<StaffWithOrganization | null> {
  if (!clerkOrgId) return null

  const memberships = await clerkClient.organizations.getOrganizationMembershipList({
    organizationId: clerkOrgId,
    userId: [clerkId],
    limit: 1,
  })

  const membership = memberships.data[0]
  if (!membership) {
    console.warn(`[Auth] Clerk membership not found for user=${clerkId} org=${clerkOrgId}`)
    return null
  }

  const organization = membership.organization
  const publicUser = membership.publicUserData
  let email = publicUser?.identifier || ''
  let firstName = publicUser?.firstName ?? null
  let lastName = publicUser?.lastName ?? null
  let imageUrl = publicUser?.imageUrl || ''

  if (!email || (!firstName && !lastName)) {
    const clerkUser = await getClerkUserFallback(clerkId)
    const primaryEmail = clerkUser?.emailAddresses.find((item) => item.id === clerkUser.primaryEmailAddressId)
    email = email || primaryEmail?.emailAddress || clerkUser?.emailAddresses[0]?.emailAddress || ''
    firstName = firstName ?? clerkUser?.firstName ?? null
    lastName = lastName ?? clerkUser?.lastName ?? null
    imageUrl = imageUrl || clerkUser?.imageUrl || ''
  }

  if (!email) {
    console.warn(`[Auth] Cannot sync Staff without email for clerkId: ${clerkId}`)
    return null
  }

  const org = await prisma.organization.upsert({
    where: { clerkOrgId },
    update: {
      name: organization.name,
      slug: organization.slug,
      logoUrl: organization.imageUrl || null,
    },
    create: {
      clerkOrgId,
      name: organization.name,
      slug: organization.slug,
      logoUrl: organization.imageUrl || null,
    },
  })

  const name = buildName(firstName, lastName)
  const role = mapClerkRole(orgRole || membership.role)
  const existingByEmail = await prisma.staff.findUnique({ where: { email } })

  if (existingByEmail?.clerkId && existingByEmail.clerkId !== clerkId) {
    console.warn(`[Auth] Refusing to relink Staff email ${email} from ${existingByEmail.clerkId} to ${clerkId}`)
    return null
  }

  const staffData = {
    clerkId,
    email,
    name,
    role,
    avatarUrl: imageUrl,
    organizationId: org.id,
    isActive: true,
  }

  if (existingByEmail) {
    await prisma.staff.update({
      where: { id: existingByEmail.id },
      data: staffData,
    })
  } else {
    await prisma.staff.upsert({
      where: { clerkId },
      update: staffData,
      create: staffData,
    })
  }

  return prisma.staff.findUnique({
    where: { clerkId },
    include: { organization: true },
  })
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
