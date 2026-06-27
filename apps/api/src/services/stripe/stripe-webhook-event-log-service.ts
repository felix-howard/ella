import type Stripe from 'stripe'
import { prisma } from '../../lib/db'

type WebhookLogStatus = 'received' | 'processing' | 'processed' | 'skipped' | 'failed'

interface WebhookProcessResult {
  processed: boolean
  type: string
}

const WEBHOOK_LOG_SELECT = {
  stripeEventId: true,
  status: true,
  attemptCount: true,
} as const
const PROCESSING_LEASE_MS = 5 * 60 * 1000

type WebhookLogState = {
  stripeEventId: string
  status: string
  attemptCount: number
}

export async function markWebhookReceived(event: Stripe.Event): Promise<WebhookLogState> {
  const existing = await readWebhookState(event.id)

  if (existing) {
    return recordDuplicateDelivery(event)
  }

  try {
    return await prisma.stripeWebhookEventLog.create({
      data: {
        stripeEventId: event.id,
        eventType: event.type,
        stripeObjectId: getEventObjectId(event),
        livemode: event.livemode,
        status: 'received',
      },
      select: WEBHOOK_LOG_SELECT,
    })
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
    return recordDuplicateDelivery(event)
  }
}

export async function claimWebhookProcessing(eventId: string): Promise<boolean> {
  const staleProcessingBefore = new Date(Date.now() - PROCESSING_LEASE_MS)
  const result = await prisma.stripeWebhookEventLog.updateMany({
    where: {
      stripeEventId: eventId,
      OR: [
        { status: { in: ['received', 'failed'] } },
        { status: 'processing', updatedAt: { lt: staleProcessingBefore } },
      ],
    },
    data: {
      status: 'processing' satisfies WebhookLogStatus,
      errorMessage: null,
      processedAt: null,
    },
  })
  return result.count > 0
}

export async function markWebhookProcessed(
  eventId: string,
  result: WebhookProcessResult
): Promise<void> {
  await prisma.stripeWebhookEventLog.updateMany({
    where: { stripeEventId: eventId },
    data: {
      eventType: result.type,
      status: result.processed ? 'processed' : 'skipped',
      errorMessage: null,
      processedAt: new Date(),
    },
  })
}

export async function markWebhookFailed(eventId: string, error: unknown): Promise<void> {
  await prisma.stripeWebhookEventLog.updateMany({
    where: {
      stripeEventId: eventId,
      status: { not: 'processed' },
    },
    data: {
      status: 'failed' satisfies WebhookLogStatus,
      errorMessage: summarizeError(error),
      processedAt: null,
    },
  })
}

export async function isAlreadyProcessed(eventId: string): Promise<boolean> {
  const log = await prisma.stripeWebhookEventLog.findUnique({
    where: { stripeEventId: eventId },
    select: { status: true },
  })
  return log?.status === 'processed'
}

export async function isWebhookTerminal(eventId: string): Promise<boolean> {
  const log = await prisma.stripeWebhookEventLog.findUnique({
    where: { stripeEventId: eventId },
    select: { status: true },
  })
  return log?.status === 'processed' || log?.status === 'skipped'
}

async function recordDuplicateDelivery(event: Stripe.Event): Promise<WebhookLogState> {
  const current = await readWebhookState(event.id)
  if (!current) {
    throw new Error(`Stripe webhook event log missing after duplicate event race: ${event.id}`)
  }

  // Do not touch an in-flight row: Prisma's @updatedAt is the processing lease.
  // Refreshing it here would make stale processing rows unreclaimable.
  if (current.status === 'processing') return current

  return prisma.stripeWebhookEventLog.update({
    where: { stripeEventId: event.id },
    data: {
      eventType: event.type,
      stripeObjectId: getEventObjectId(event),
      livemode: event.livemode,
      receivedAt: new Date(),
      attemptCount: { increment: 1 },
    },
    select: WEBHOOK_LOG_SELECT,
  })
}

function readWebhookState(eventId: string): Promise<WebhookLogState | null> {
  return prisma.stripeWebhookEventLog.findUnique({
    where: { stripeEventId: eventId },
    select: WEBHOOK_LOG_SELECT,
  })
}

function getEventObjectId(event: Stripe.Event): string | null {
  const object = event.data.object as { id?: unknown } | undefined
  return typeof object?.id === 'string' ? object.id : null
}

function summarizeError(error: unknown): string {
  const name = error instanceof Error ? error.name : 'Error'
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : null
  const message = error instanceof Error ? error.message : String(error)
  const summary = `${name}${code ? ` ${code}` : ''}: ${redactErrorText(message)}`
  return summary.replace(/\s+/g, ' ').trim().slice(0, 500) || 'Error: Unknown error'
}

function redactErrorText(message: string): string {
  return message
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(
      /\b(?:sk|rk|pk|whsec|tok|evt|req|cs|pi|ch|in|cus|sub|pm|price|prod|seti|si)_[A-Za-z0-9_=-]+\b/g,
      '[stripe_id]'
    )
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[number]')
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: string }).code === 'P2002')
}
