import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { config } from '../../lib/config'
import { prisma } from '../../lib/db'
import type { AuthVariables } from '../../middleware/auth'
import { rateLimiter } from '../../middleware/rate-limiter'
import {
  buildTestPushPayload,
  sendWebPushToStaff,
  type WebPushSubscriptionRecord,
} from '../../services/web-push'
import { buildDeviceLabel, summarizeUserAgent } from './device-metadata'
import { saveCurrentStaffSubscription } from './push-subscription-repository'
import { pushEndpointSchema, pushSubscribeSchema } from './schemas'

const pushTestRateLimit = rateLimiter({
  keyPrefix: 'push-test',
  maxRequests: 5,
  windowMs: 60000,
})

const pushRoute = new Hono<{ Variables: AuthVariables }>()

function requireStaffContext(user: AuthVariables['user']) {
  if (!user.staffId || !user.organizationId) return null
  return { staffId: user.staffId, organizationId: user.organizationId }
}

function serializeSubscription(subscription: WebPushSubscriptionRecord) {
  return {
    id: subscription.id,
    deviceLabel: subscription.deviceLabel,
    userAgent: subscription.userAgent,
    createdAt: subscription.createdAt.toISOString(),
    lastSeenAt: subscription.lastSeenAt.toISOString(),
    lastSentAt: subscription.lastSentAt?.toISOString() ?? null,
  }
}

pushRoute.get('/vapid-public-key', (c) => {
  return c.json({
    configured: config.webPush.isConfigured,
    publicKey: config.webPush.isConfigured ? config.webPush.vapidPublicKey : null,
  })
})

pushRoute.get('/subscriptions', async (c) => {
  const staffContext = requireStaffContext(c.get('user'))
  if (!staffContext) return c.json({ error: 'Staff organization required' }, 400)

  const subscriptions = await prisma.webPushSubscription.findMany({
    where: {
      ...staffContext,
      enabled: true,
    },
    select: {
      id: true,
      deviceLabel: true,
      userAgent: true,
      createdAt: true,
      lastSeenAt: true,
      lastSentAt: true,
    },
    orderBy: [{ lastSeenAt: 'desc' }, { createdAt: 'desc' }],
  })

  return c.json({ data: subscriptions.map(serializeSubscription) })
})

pushRoute.post(
  '/current',
  zValidator('json', pushEndpointSchema),
  async (c) => {
    const staffContext = requireStaffContext(c.get('user'))
    if (!staffContext) return c.json({ error: 'Staff organization required' }, 400)

    const { endpoint } = c.req.valid('json')
    const subscription = await prisma.webPushSubscription.findFirst({
      where: {
        endpoint,
        ...staffContext,
        enabled: true,
      },
      select: {
        id: true,
        deviceLabel: true,
        userAgent: true,
        createdAt: true,
        lastSeenAt: true,
        lastSentAt: true,
      },
    })

    return c.json({
      current: Boolean(subscription),
      data: subscription ? serializeSubscription(subscription) : null,
    })
  }
)

pushRoute.post(
  '/subscribe',
  zValidator('json', pushSubscribeSchema),
  async (c) => {
    const staffContext = requireStaffContext(c.get('user'))
    if (!staffContext) return c.json({ error: 'Staff organization required' }, 400)

    const input = c.req.valid('json')
    const now = new Date()
    const userAgent = summarizeUserAgent(c.req.header('user-agent'))
    const deviceLabel = buildDeviceLabel(userAgent)

    const saveResult = await saveCurrentStaffSubscription(staffContext, input.endpoint, {
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      enabled: true,
      userAgent,
      deviceLabel,
      lastSeenAt: now,
      failureCount: 0,
      failedAt: null,
    })

    if (saveResult.status === 'owned_by_other') {
      return c.json({ error: 'SUBSCRIPTION_OWNED_BY_ANOTHER_STAFF' }, 409)
    }

    return c.json({ data: serializeSubscription(saveResult.subscription) }, 201)
  }
)

pushRoute.post(
  '/unsubscribe',
  zValidator('json', pushEndpointSchema),
  async (c) => {
    const staffContext = requireStaffContext(c.get('user'))
    if (!staffContext) return c.json({ error: 'Staff organization required' }, 400)

    const { endpoint } = c.req.valid('json')
    const result = await prisma.webPushSubscription.updateMany({
      where: {
        endpoint,
        ...staffContext,
      },
      data: {
        enabled: false,
        lastSeenAt: new Date(),
      },
    })

    return c.json({ success: true, disabled: result.count > 0 })
  }
)

pushRoute.post('/test', pushTestRateLimit, async (c) => {
  const staffContext = requireStaffContext(c.get('user'))
  if (!staffContext) return c.json({ error: 'Staff organization required' }, 400)

  const result = await sendWebPushToStaff({
    organizationId: staffContext.organizationId,
    staffIds: [staffContext.staffId],
    payload: buildTestPushPayload(),
  })

  if (!result.configured) {
    return c.json({ success: false, result }, 503)
  }
  if (result.skippedReason === 'query_failed') {
    return c.json({ success: false, result }, 503)
  }

  return c.json({ success: result.sent > 0, result })
})

export { pushRoute }
