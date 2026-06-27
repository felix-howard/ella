import * as webPush from 'web-push'
import { config } from '../../lib/config'
import { prisma } from '../../lib/db'
import { boundedPromiseMap } from './bounded-promise-map'
import type { SafePushPayload } from './push-payloads'
import { loadEnabledDeliverySubscriptions } from './push-subscription-loader'
import { isAllowedWebPushEndpoint } from './web-push-endpoint-validation'
import type {
  DeliverySubscription,
  SendWebPushToStaffInput,
  WebPushDeliveryResult,
} from './push-delivery-types'

const WEB_PUSH_TTL_SECONDS = 14400
const WEB_PUSH_TIMEOUT_MS = 8000
const WEB_PUSH_SEND_CONCURRENCY = 10
let configuredVapidSignature: string | null = null

function configureWebPush(): boolean {
  if (!config.webPush.isConfigured) return false

  const signature = [
    config.webPush.vapidSubject,
    config.webPush.vapidPublicKey,
    config.webPush.vapidPrivateKey,
  ].join('|')

  if (configuredVapidSignature !== signature) {
    webPush.setVapidDetails(
      config.webPush.vapidSubject,
      config.webPush.vapidPublicKey,
      config.webPush.vapidPrivateKey
    )
    configuredVapidSignature = signature
  }

  return true
}

async function ignoreSubscriptionUpdate(update: Promise<unknown>) {
  try {
    await update
  } catch {
    // Delivery must never block message flows because subscription bookkeeping failed.
  }
}

function emptyResult(
  configured: boolean,
  skippedReason?: WebPushDeliveryResult['skippedReason']
): WebPushDeliveryResult {
  return {
    configured,
    attempted: 0,
    sent: 0,
    failed: 0,
    disabled: 0,
    skippedReason,
    failures: [],
  }
}

function getStatusCode(error: unknown): number | undefined {
  const statusCode = (error as { statusCode?: unknown })?.statusCode
  return typeof statusCode === 'number' ? statusCode : undefined
}

function deliverySnapshotWhere(subscription: DeliverySubscription) {
  return {
    id: subscription.id,
    staffId: subscription.staffId,
    organizationId: subscription.organizationId,
    endpoint: subscription.endpoint,
    p256dh: subscription.p256dh,
    auth: subscription.auth,
    enabled: true,
  }
}

async function markSent(subscription: DeliverySubscription) {
  await ignoreSubscriptionUpdate(
    prisma.webPushSubscription.updateMany({
      where: deliverySnapshotWhere(subscription),
      data: { lastSentAt: new Date(), failureCount: 0, failedAt: null },
    })
  )
}

async function markFailed(subscription: DeliverySubscription, disable: boolean) {
  await ignoreSubscriptionUpdate(
    prisma.webPushSubscription.updateMany({
      where: deliverySnapshotWhere(subscription),
      data: {
        enabled: disable ? false : undefined,
        failureCount: { increment: 1 },
        failedAt: new Date(),
      },
    })
  )
}

async function sendOne(
  subscription: DeliverySubscription,
  payload: SafePushPayload
): Promise<{ sent: boolean; disabled: boolean; statusCode?: number }> {
  if (!isAllowedWebPushEndpoint(subscription.endpoint)) {
    await markFailed(subscription, true)
    return { sent: false, disabled: true }
  }

  try {
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload),
      { TTL: WEB_PUSH_TTL_SECONDS, timeout: WEB_PUSH_TIMEOUT_MS }
    )
    await markSent(subscription)
    return { sent: true, disabled: false }
  } catch (error) {
    const statusCode = getStatusCode(error)
    const disabled = statusCode === 404 || statusCode === 410
    await markFailed(subscription, disabled)
    return { sent: false, disabled, statusCode }
  }
}

export async function sendWebPushToStaff(
  input: SendWebPushToStaffInput
): Promise<WebPushDeliveryResult> {
  try {
    if (!configureWebPush()) return emptyResult(false, 'not_configured')
  } catch {
    return emptyResult(false, 'configuration_error')
  }

  const staffIds = [...new Set(input.staffIds.filter(Boolean))]
  if (staffIds.length === 0) return emptyResult(true, 'no_staff')

  let subscriptions: DeliverySubscription[]
  try {
    subscriptions = await loadEnabledDeliverySubscriptions(input.organizationId, staffIds)
  } catch {
    return emptyResult(true, 'query_failed')
  }

  if (subscriptions.length === 0) return emptyResult(true, 'no_subscriptions')

  const outcomes = await boundedPromiseMap(
    subscriptions,
    WEB_PUSH_SEND_CONCURRENCY,
    (subscription) => sendOne(subscription, input.payload)
  )

  return outcomes.reduce<WebPushDeliveryResult>(
    (result, outcome, index) => {
      if (outcome.sent) {
        result.sent += 1
      } else {
        result.failed += 1
        result.failures.push({
          subscriptionId: subscriptions[index].id,
          statusCode: outcome.statusCode,
        })
      }

      if (outcome.disabled) result.disabled += 1
      return result
    },
    {
      configured: true,
      attempted: subscriptions.length,
      sent: 0,
      failed: 0,
      disabled: 0,
      failures: [],
    }
  )
}
