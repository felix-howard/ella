import type { OrganizationMembership } from '@clerk/backend'
import { clerkClient } from '../../lib/clerk-client'
import { isClerkMembershipNotFoundError } from './team-clerk-errors'

export type ClerkRemovalResult = 'removed' | 'already_removed' | 'skipped_no_clerk_id'

function membershipUserId(membership: OrganizationMembership): string | null {
  return membership.publicUserData?.userId ?? null
}

export async function removeClerkOrganizationMembershipIfPresent(input: {
  organizationId: string
  clerkUserId: string | null
  emailAddress?: string | null
}): Promise<ClerkRemovalResult> {
  if (!input.clerkUserId && !input.emailAddress) return 'skipped_no_clerk_id'

  let existingMemberships = input.clerkUserId
    ? await clerkClient.organizations.getOrganizationMembershipList({
      organizationId: input.organizationId,
      userId: [input.clerkUserId],
      limit: 1,
    })
    : { data: [], totalCount: 0 }

  if (existingMemberships.data.length === 0 && input.emailAddress) {
    existingMemberships = await clerkClient.organizations.getOrganizationMembershipList({
      organizationId: input.organizationId,
      emailAddress: [input.emailAddress],
      limit: 1,
    })
  }

  if (existingMemberships.data.length === 0) return 'already_removed'
  const clerkUserId = membershipUserId(existingMemberships.data[0])
  if (!clerkUserId) {
    throw new Error('Clerk membership response did not include a user id')
  }

  try {
    await clerkClient.organizations.deleteOrganizationMembership({
      organizationId: input.organizationId,
      userId: clerkUserId,
    })
    return 'removed'
  } catch (error) {
    if (isClerkMembershipNotFoundError(error)) return 'already_removed'
    throw error
  }
}
