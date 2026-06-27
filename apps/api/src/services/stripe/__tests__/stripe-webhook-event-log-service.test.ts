import { beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'

const prismaMocks = vi.hoisted(() => ({
  stripeWebhookEventLog: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
}))

vi.mock('../../../lib/db', () => ({ prisma: prismaMocks }))

import {
  claimWebhookProcessing,
  markWebhookFailed,
  markWebhookReceived,
} from '../stripe-webhook-event-log-service'

function stripeEvent(overrides: Partial<Stripe.Event> = {}): Stripe.Event {
  return {
    id: 'evt_123',
    object: 'event',
    api_version: '2026-03-31.basil',
    created: 1_800_000_000,
    data: { object: { id: 'cs_123', object: 'checkout.session' } },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: 'checkout.session.completed',
    ...overrides,
  } as Stripe.Event
}

describe('stripe webhook event log service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('preserves processed status when a duplicate delivery is received', async () => {
    prismaMocks.stripeWebhookEventLog.findUnique.mockResolvedValue({
      stripeEventId: 'evt_123',
      status: 'processed',
      attemptCount: 1,
    })
    prismaMocks.stripeWebhookEventLog.update.mockResolvedValue({
      stripeEventId: 'evt_123',
      status: 'processed',
      attemptCount: 2,
    })

    await expect(markWebhookReceived(stripeEvent())).resolves.toEqual({
      stripeEventId: 'evt_123',
      status: 'processed',
      attemptCount: 2,
    })

    expect(prismaMocks.stripeWebhookEventLog.update).toHaveBeenCalledWith({
      where: { stripeEventId: 'evt_123' },
      data: expect.not.objectContaining({ status: 'received' }),
      select: expect.any(Object),
    })
  })

  it('re-reads current state on unique races before recording the retry attempt', async () => {
    prismaMocks.stripeWebhookEventLog.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        stripeEventId: 'evt_123',
        status: 'processed',
        attemptCount: 1,
      })
    prismaMocks.stripeWebhookEventLog.create.mockRejectedValue(
      Object.assign(new Error('Unique'), { code: 'P2002' })
    )
    prismaMocks.stripeWebhookEventLog.update.mockResolvedValue({
      stripeEventId: 'evt_123',
      status: 'processed',
      attemptCount: 2,
    })

    await expect(markWebhookReceived(stripeEvent())).resolves.toEqual({
      stripeEventId: 'evt_123',
      status: 'processed',
      attemptCount: 2,
    })

    expect(prismaMocks.stripeWebhookEventLog.findUnique).toHaveBeenCalledTimes(2)
    expect(prismaMocks.stripeWebhookEventLog.update).toHaveBeenCalledWith({
      where: { stripeEventId: 'evt_123' },
      data: expect.not.objectContaining({ status: 'received' }),
      select: expect.any(Object),
    })
  })

  it('does not refresh the lease timestamp for in-flight processing duplicates', async () => {
    prismaMocks.stripeWebhookEventLog.findUnique.mockResolvedValue({
      stripeEventId: 'evt_123',
      status: 'processing',
      attemptCount: 2,
    })

    await expect(markWebhookReceived(stripeEvent())).resolves.toEqual({
      stripeEventId: 'evt_123',
      status: 'processing',
      attemptCount: 2,
    })

    expect(prismaMocks.stripeWebhookEventLog.update).not.toHaveBeenCalled()
  })

  it('atomically claims only received or failed events for processing', async () => {
    prismaMocks.stripeWebhookEventLog.updateMany.mockResolvedValue({ count: 1 })

    await expect(claimWebhookProcessing('evt_123')).resolves.toBe(true)

    expect(prismaMocks.stripeWebhookEventLog.updateMany).toHaveBeenCalledWith({
      where: {
        stripeEventId: 'evt_123',
        OR: [
          { status: { in: ['received', 'failed'] } },
          { status: 'processing', updatedAt: { lt: expect.any(Date) } },
        ],
      },
      data: {
        status: 'processing',
        errorMessage: null,
        processedAt: null,
      },
    })
  })

  it('does not overwrite processed events with failed status and redacts error text', async () => {
    const error = Object.assign(
      new Error(
        'Request failed for jane@example.com using sk_test_secret at https://example.test/callback?token=abc with +1 (415) 555-1212 and pi_123'
      ),
      { code: 'STRIPE_ERROR' }
    )

    await markWebhookFailed('evt_123', error)

    expect(prismaMocks.stripeWebhookEventLog.updateMany).toHaveBeenCalledWith({
      where: {
        stripeEventId: 'evt_123',
        status: { not: 'processed' },
      },
      data: {
        status: 'failed',
        errorMessage:
          'Error STRIPE_ERROR: Request failed for [email] using [stripe_id] at [url] with [number] and [stripe_id]',
        processedAt: null,
      },
    })
  })
})
