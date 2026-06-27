import { prisma } from '../../lib/db'
import type { WebPushSubscriptionRecord } from '../../services/web-push'

const ACTIVE_SUBSCRIPTION_LIMIT_PER_STAFF = 10

type StaffContext = {
  staffId: string
  organizationId: string
}

type SubscriptionData = {
  p256dh: string
  auth: string
  enabled: true
  userAgent: string | null
  deviceLabel: string
  lastSeenAt: Date
  failureCount: 0
  failedAt: null
}

type ExistingSubscription = {
  id: string
  staffId: string
  organizationId: string
}

export type SaveSubscriptionResult =
  | { status: 'saved'; subscription: WebPushSubscriptionRecord }
  | { status: 'owned_by_other' }

const subscriptionSelect = {
  id: true,
  deviceLabel: true,
  userAgent: true,
  createdAt: true,
  lastSeenAt: true,
  lastSentAt: true,
} as const

function isOwnedByDifferentStaff(
  subscription: ExistingSubscription,
  staffContext: StaffContext
): boolean {
  return (
    subscription.staffId !== staffContext.staffId ||
    subscription.organizationId !== staffContext.organizationId
  )
}

function isUniqueConstraintError(error: unknown): boolean {
  return (error as { code?: unknown })?.code === 'P2002'
}

async function findSubscriptionOwner(endpoint: string): Promise<ExistingSubscription | null> {
  return prisma.webPushSubscription.findUnique({
    where: { endpoint },
    select: { id: true, staffId: true, organizationId: true },
  })
}

async function updateSubscription(id: string, data: SubscriptionData) {
  return prisma.webPushSubscription.update({
    where: { id },
    data,
    select: subscriptionSelect,
  })
}

async function enforceActiveSubscriptionLimit(staffContext: StaffContext, keepId: string) {
  const staleSubscriptions = await prisma.webPushSubscription.findMany({
    where: {
      ...staffContext,
      enabled: true,
      id: { not: keepId },
    },
    select: { id: true },
    orderBy: [{ lastSeenAt: 'desc' }, { createdAt: 'desc' }],
    skip: ACTIVE_SUBSCRIPTION_LIMIT_PER_STAFF - 1,
  })

  if (staleSubscriptions.length === 0) return
  await prisma.webPushSubscription.updateMany({
    where: { id: { in: staleSubscriptions.map((subscription) => subscription.id) } },
    data: { enabled: false },
  })
}

export async function saveCurrentStaffSubscription(
  staffContext: StaffContext,
  endpoint: string,
  data: SubscriptionData
): Promise<SaveSubscriptionResult> {
  const existingSubscription = await findSubscriptionOwner(endpoint)
  if (existingSubscription) {
    if (isOwnedByDifferentStaff(existingSubscription, staffContext)) {
      return { status: 'owned_by_other' }
    }

    const subscription = await updateSubscription(existingSubscription.id, data)
    await enforceActiveSubscriptionLimit(staffContext, subscription.id)
    return { status: 'saved', subscription }
  }

  try {
    const subscription = await prisma.webPushSubscription.create({
      data: { ...staffContext, endpoint, ...data },
      select: subscriptionSelect,
    })
    await enforceActiveSubscriptionLimit(staffContext, subscription.id)
    return { status: 'saved', subscription }
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error

    const racedSubscription = await findSubscriptionOwner(endpoint)
    if (!racedSubscription || isOwnedByDifferentStaff(racedSubscription, staffContext)) {
      return { status: 'owned_by_other' }
    }

    const subscription = await updateSubscription(racedSubscription.id, data)
    await enforceActiveSubscriptionLimit(staffContext, subscription.id)
    return { status: 'saved', subscription }
  }
}
