import type { SafePushPayload } from './push-payloads'

export type WebPushSubscriptionRecord = {
  id: string
  deviceLabel: string | null
  userAgent: string | null
  createdAt: Date
  lastSeenAt: Date
  lastSentAt: Date | null
}

export type DeliverySubscription = {
  id: string
  staffId: string
  organizationId: string
  endpoint: string
  p256dh: string
  auth: string
}

export type WebPushDeliveryResult = {
  configured: boolean
  attempted: number
  sent: number
  failed: number
  disabled: number
  skippedReason?: 'not_configured' | 'configuration_error' | 'query_failed' | 'no_staff' | 'no_subscriptions'
  failures: Array<{
    subscriptionId: string
    statusCode?: number
  }>
}

export type SendWebPushToStaffInput = {
  organizationId: string
  staffIds: string[]
  payload: SafePushPayload
}
