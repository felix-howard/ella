import { prisma } from '../../lib/db'
import type { DeliverySubscription } from './push-delivery-types'

const WEB_PUSH_DELIVERY_SUBSCRIPTION_PAGE_SIZE = 500

const deliverySubscriptionSelect = {
  id: true,
  staffId: true,
  organizationId: true,
  endpoint: true,
  p256dh: true,
  auth: true,
} as const

export async function loadEnabledDeliverySubscriptions(
  organizationId: string,
  staffIds: string[]
): Promise<DeliverySubscription[]> {
  const subscriptions: DeliverySubscription[] = []
  let cursor: { id: string } | undefined

  for (;;) {
    const page = await prisma.webPushSubscription.findMany({
      where: {
        organizationId,
        staffId: { in: staffIds },
        enabled: true,
        staff: { isActive: true },
      },
      select: deliverySubscriptionSelect,
      orderBy: { id: 'asc' },
      take: WEB_PUSH_DELIVERY_SUBSCRIPTION_PAGE_SIZE,
      ...(cursor ? { cursor, skip: 1 } : {}),
    })

    subscriptions.push(...page)
    if (page.length < WEB_PUSH_DELIVERY_SUBSCRIPTION_PAGE_SIZE) break
    cursor = { id: page[page.length - 1].id }
  }

  return subscriptions
}
