import type { OrganizationInvitation, OrganizationMembership } from '@clerk/backend'
import type { StaffRole } from '@ella/db'
import { prisma } from '../../lib/db'
import { clerkClient } from '../../lib/clerk-client'

const CLERK_PAGE_SIZE = 100

export type TeamMembershipStatus =
  | 'ACTIVE_MATCH'
  | 'ARCHIVED_MATCH'
  | 'ARCHIVED_STILL_IN_CLERK'
  | 'ACTIVE_MISSING_CLERK'
  | 'CLERK_MISSING_STAFF'
  | 'PENDING_INVITATION'

type StaffForReconciliation = {
  id: string
  clerkId: string | null
  email: string
  name: string
  role: StaffRole
  isActive: boolean
  _count: { managedClientLinks: number }
}

type TeamReconciliationMember = {
  status: TeamMembershipStatus
  staffId: string | null
  clerkUserId: string | null
  invitationId: string | null
  email: string
  name: string | null
  appRole: StaffRole | null
  clerkRole: string | null
  isActive: boolean | null
  managedClientCount: number | null
}

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

function membershipUserId(membership: OrganizationMembership): string | null {
  return membership.publicUserData?.userId ?? null
}

function membershipEmail(membership: OrganizationMembership): string {
  return membership.publicUserData?.identifier ?? ''
}

function displayNameFromMembership(membership: OrganizationMembership): string | null {
  const name = [
    membership.publicUserData?.firstName,
    membership.publicUserData?.lastName,
  ].filter(Boolean).join(' ')
  return name || null
}

async function getAllMemberships(clerkOrgId: string) {
  const data: OrganizationMembership[] = []
  let totalCount = 0

  do {
    const page = await clerkClient.organizations.getOrganizationMembershipList({
      organizationId: clerkOrgId,
      limit: CLERK_PAGE_SIZE,
      offset: data.length,
    })
    data.push(...page.data)
    totalCount = page.totalCount
  } while (data.length < totalCount)

  return { data, totalCount }
}

async function getPendingInvitations(clerkOrgId: string) {
  const data: OrganizationInvitation[] = []
  let totalCount = 0

  do {
    const page = await clerkClient.organizations.getOrganizationInvitationList({
      organizationId: clerkOrgId,
      status: ['pending'],
      limit: CLERK_PAGE_SIZE,
      offset: data.length,
    })
    data.push(...page.data)
    totalCount = page.totalCount
  } while (data.length < totalCount)

  return { data, totalCount }
}

function statusForStaff(staff: StaffForReconciliation, membership: OrganizationMembership | null): TeamMembershipStatus {
  if (staff.isActive && membership) return 'ACTIVE_MATCH'
  if (!staff.isActive && membership) return 'ARCHIVED_STILL_IN_CLERK'
  if (!staff.isActive) return 'ARCHIVED_MATCH'
  return 'ACTIVE_MISSING_CLERK'
}

export async function buildTeamReconciliation(input: {
  organizationId: string
  clerkOrgId: string
}) {
  const [staffRows, clerkMemberships, pendingInvitations] = await Promise.all([
    prisma.staff.findMany({
      where: { organizationId: input.organizationId },
      select: {
        id: true,
        clerkId: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        _count: { select: { managedClientLinks: true } },
      },
      orderBy: { name: 'asc' },
    }),
    getAllMemberships(input.clerkOrgId),
    getPendingInvitations(input.clerkOrgId),
  ])

  const membershipsByUserId = new Map<string, OrganizationMembership>()
  const membershipsByEmail = new Map<string, OrganizationMembership>()
  for (const membership of clerkMemberships.data) {
    const userId = membershipUserId(membership)
    const email = normalizeEmail(membershipEmail(membership))
    if (userId) membershipsByUserId.set(userId, membership)
    if (email) membershipsByEmail.set(email, membership)
  }

  const matchedMembershipIds = new Set<string>()
  const rows: TeamReconciliationMember[] = staffRows.map((staff) => {
    const membership = staff.clerkId
      ? membershipsByUserId.get(staff.clerkId) ?? null
      : membershipsByEmail.get(normalizeEmail(staff.email)) ?? null

    if (membership) matchedMembershipIds.add(membership.id)

    return {
      status: statusForStaff(staff, membership),
      staffId: staff.id,
      clerkUserId: membership ? membershipUserId(membership) : staff.clerkId,
      invitationId: null,
      email: staff.email,
      name: staff.name,
      appRole: staff.role,
      clerkRole: membership?.role ?? null,
      isActive: staff.isActive,
      managedClientCount: staff._count.managedClientLinks,
    }
  })

  for (const membership of clerkMemberships.data) {
    if (matchedMembershipIds.has(membership.id)) continue

    rows.push({
      status: 'CLERK_MISSING_STAFF',
      staffId: null,
      clerkUserId: membershipUserId(membership),
      invitationId: null,
      email: membershipEmail(membership),
      name: displayNameFromMembership(membership),
      appRole: null,
      clerkRole: membership.role,
      isActive: null,
      managedClientCount: null,
    })
  }

  const staffByEmail = new Map(staffRows.map((staff) => [normalizeEmail(staff.email), staff]))
  for (const invitation of pendingInvitations.data) {
    const staff = staffByEmail.get(normalizeEmail(invitation.emailAddress)) ?? null
    rows.push({
      status: 'PENDING_INVITATION',
      staffId: staff?.id ?? null,
      clerkUserId: staff?.clerkId ?? null,
      invitationId: invitation.id,
      email: invitation.emailAddress,
      name: staff?.name ?? null,
      appRole: staff?.role ?? null,
      clerkRole: invitation.role,
      isActive: staff?.isActive ?? null,
      managedClientCount: staff?._count.managedClientLinks ?? null,
    })
  }

  return {
    seatsUsed: clerkMemberships.totalCount,
    staffCount: staffRows.length,
    pendingInvitationCount: pendingInvitations.totalCount,
    members: rows,
  }
}
