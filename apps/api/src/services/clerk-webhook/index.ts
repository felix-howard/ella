/**
 * Clerk Webhook Service
 * Routes incoming Clerk webhook events to appropriate handlers
 * Syncs Clerk user/org/membership data to DB
 */
import type { WebhookEvent } from '@clerk/backend'
import { prisma } from '../../lib/db'

// --- Type definitions for Clerk event data ---

interface UserEventData {
  id: string
  email_addresses: Array<{ email_address: string; id: string }>
  first_name: string | null
  last_name: string | null
  image_url: string
}

interface UserDeletedEventData {
  id?: string
  deleted?: boolean
}

interface OrganizationEventData {
  id: string
  name: string
  slug: string | null
  image_url: string | null
}

interface MembershipEventData {
  id: string
  role: string
  organization: {
    id: string
    name: string
    slug: string | null
    image_url: string | null
  }
  public_user_data: {
    user_id: string
    identifier: string
    first_name: string | null
    last_name: string | null
    image_url: string
  }
}

// --- Helpers ---

function mapClerkRole(clerkRole: string): 'ADMIN' | 'STAFF' {
  return clerkRole === 'org:admin' ? 'ADMIN' : 'STAFF'
}

function buildName(firstName: string | null, lastName: string | null): string {
  return [firstName, lastName].filter(Boolean).join(' ') || 'Unknown'
}

/** Check if avatar is a custom R2 upload (not from Clerk) */
function isCustomAvatar(avatarUrl: string | null): boolean {
  if (!avatarUrl) return false
  return avatarUrl.startsWith('avatars/')
}

/** Shared org upsert - DRY for created/updated/membership handlers */
async function upsertOrganization(d: OrganizationEventData) {
  return prisma.organization.upsert({
    where: { clerkOrgId: d.id },
    update: { name: d.name, slug: d.slug, logoUrl: d.image_url },
    create: { clerkOrgId: d.id, name: d.name, slug: d.slug, logoUrl: d.image_url },
  })
}

// --- User Handlers ---

async function handleUserCreated(data: unknown): Promise<void> {
  const d = data as UserEventData
  if (!d?.id || !d?.email_addresses?.length) {
    console.warn('[ClerkWebhook] user.created: missing required fields')
    return
  }

  const email = d.email_addresses[0].email_address
  if (!email) return

  const name = buildName(d.first_name, d.last_name)

  // Upsert staff - may already exist from membership.created (out-of-order)
  await prisma.staff.upsert({
    where: { clerkId: d.id },
    update: { email, name, avatarUrl: d.image_url },
    create: { clerkId: d.id, email, name, avatarUrl: d.image_url },
  })
  console.log(`[ClerkWebhook] user.created: ${d.id}`)
}

async function handleUserUpdated(data: unknown): Promise<void> {
  const d = data as UserEventData
  if (!d?.id || !d?.email_addresses?.length) {
    console.warn('[ClerkWebhook] user.updated: missing required fields')
    return
  }

  const email = d.email_addresses[0].email_address
  if (!email) return

  const name = buildName(d.first_name, d.last_name)

  // Preserve custom R2 avatars - only update if staff has no custom upload
  const existing = await prisma.staff.findFirst({ where: { clerkId: d.id } })
  const avatarUpdate = isCustomAvatar(existing?.avatarUrl ?? null)
    ? {} // Keep custom avatar
    : { avatarUrl: d.image_url }

  await prisma.staff.updateMany({
    where: { clerkId: d.id },
    data: { email, name, ...avatarUpdate },
  })
  console.log(`[ClerkWebhook] user.updated: ${d.id}`)
}

async function handleUserDeleted(data: unknown): Promise<void> {
  const d = data as UserDeletedEventData
  if (!d?.id) {
    console.warn('[ClerkWebhook] user.deleted: missing user id')
    return
  }

  await prisma.staff.updateMany({
    where: { clerkId: d.id },
    data: { isActive: false, deactivatedAt: new Date() },
  })
  console.log(`[ClerkWebhook] user.deleted: ${d.id}`)
}

// --- Organization Handlers ---

async function handleOrgCreated(data: unknown): Promise<void> {
  const d = data as OrganizationEventData
  if (!d?.id || !d?.name) {
    console.warn('[ClerkWebhook] organization.created: missing required fields')
    return
  }

  await upsertOrganization(d)
  console.log(`[ClerkWebhook] organization.created: ${d.id}`)
}

async function handleOrgUpdated(data: unknown): Promise<void> {
  const d = data as OrganizationEventData
  if (!d?.id || !d?.name) {
    console.warn('[ClerkWebhook] organization.updated: missing required fields')
    return
  }

  await upsertOrganization(d)
  console.log(`[ClerkWebhook] organization.updated: ${d.id}`)
}

// --- Membership Handlers ---

async function handleMembershipCreated(data: unknown): Promise<void> {
  const d = data as MembershipEventData
  if (!d?.organization?.id || !d?.public_user_data?.user_id) {
    console.warn('[ClerkWebhook] membership.created: missing required fields')
    return
  }

  // 1. Ensure org exists
  const org = await prisma.organization.upsert({
    where: { clerkOrgId: d.organization.id },
    update: {},
    create: {
      clerkOrgId: d.organization.id,
      name: d.organization.name,
      slug: d.organization.slug,
      logoUrl: d.organization.image_url,
    },
  })

  // 2. Upsert staff member
  const { user_id, identifier: email, first_name, last_name, image_url } = d.public_user_data
  const name = buildName(first_name, last_name)
  const role = mapClerkRole(d.role)

  // Check by email first (staff may exist before Clerk link)
  const existingByEmail = email
    ? await prisma.staff.findUnique({ where: { email } })
    : null

  if (existingByEmail) {
    await prisma.staff.update({
      where: { id: existingByEmail.id },
      data: {
        clerkId: user_id,
        name,
        role,
        avatarUrl: image_url,
        organizationId: org.id,
        isActive: true,
      },
    })
  } else {
    await prisma.staff.upsert({
      where: { clerkId: user_id },
      update: {
        email,
        name,
        role,
        avatarUrl: image_url,
        organizationId: org.id,
        isActive: true,
      },
      create: {
        clerkId: user_id,
        email,
        name,
        role,
        avatarUrl: image_url,
        organizationId: org.id,
      },
    })
  }
  console.log(`[ClerkWebhook] membership.created: user=${user_id} org=${d.organization.id}`)
}

async function handleMembershipUpdated(data: unknown): Promise<void> {
  const d = data as MembershipEventData
  if (!d?.public_user_data?.user_id || !d?.role) {
    console.warn('[ClerkWebhook] membership.updated: missing required fields')
    return
  }

  const role = mapClerkRole(d.role)

  await prisma.staff.updateMany({
    where: { clerkId: d.public_user_data.user_id },
    data: { role },
  })
  console.log(`[ClerkWebhook] membership.updated: user=${d.public_user_data.user_id} role=${role}`)
}

async function handleMembershipDeleted(data: unknown): Promise<void> {
  const d = data as MembershipEventData
  if (!d?.public_user_data?.user_id || !d?.organization?.id) {
    console.warn('[ClerkWebhook] membership.deleted: missing required fields')
    return
  }

  // Find org to scope deactivation to correct membership
  const org = await prisma.organization.findUnique({
    where: { clerkOrgId: d.organization.id },
  })

  if (org) {
    await prisma.staff.updateMany({
      where: {
        clerkId: d.public_user_data.user_id,
        organizationId: org.id,
      },
      data: { isActive: false, deactivatedAt: new Date() },
    })
  }
  console.log(`[ClerkWebhook] membership.deleted: user=${d.public_user_data.user_id}`)
}

// --- Event Router ---

type EventHandler = (data: unknown) => Promise<void>

const eventHandlers: Record<string, EventHandler> = {
  'user.created': handleUserCreated,
  'user.updated': handleUserUpdated,
  'user.deleted': handleUserDeleted,
  'organization.created': handleOrgCreated,
  'organization.updated': handleOrgUpdated,
  'organizationMembership.created': handleMembershipCreated,
  'organizationMembership.updated': handleMembershipUpdated,
  'organizationMembership.deleted': handleMembershipDeleted,
}

export async function handleClerkWebhook(event: WebhookEvent): Promise<void> {
  console.log(`[ClerkWebhook] Received: ${event.type}`)

  const handler = eventHandlers[event.type]
  if (!handler) {
    console.log(`[ClerkWebhook] Unhandled event: ${event.type}`)
    return
  }

  try {
    await handler(event.data)
    console.log(`[ClerkWebhook] Processed: ${event.type}`)
  } catch (err) {
    console.error(`[ClerkWebhook] Failed: ${event.type}`, err)
    throw err // Re-throw so route returns 500 and Clerk retries
  }
}
