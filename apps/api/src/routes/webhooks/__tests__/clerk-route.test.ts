/**
 * Clerk Webhook Route Tests
 * Tests signature verification, header validation, error handling
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock config
vi.mock('../../../lib/config', () => ({
  config: {
    clerk: { webhookSecret: 'whsec_test_secret' },
  },
}))

// Mock svix
vi.mock('svix', () => {
  return {
    Webhook: vi.fn(function(this: Record<string, unknown>) {
      this.verify = vi.fn()
    }),
  }
})

// Mock webhook handler
vi.mock('../../../services/clerk-webhook', () => ({
  handleClerkWebhook: vi.fn(),
}))

import { Webhook } from 'svix'
import { handleClerkWebhook } from '../../../services/clerk-webhook'
import { clerkWebhookRoute } from '../clerk'

import { Hono } from 'hono'

function createApp() {
  const app = new Hono()
  app.route('/webhooks/clerk', clerkWebhookRoute)
  return app
}

const validHeaders = {
  'svix-id': 'msg_123',
  'svix-timestamp': '1234567890',
  'svix-signature': 'v1,abc123',
  'Content-Type': 'application/json',
}

describe('Clerk Webhook Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: verify returns a valid event
    const mockVerify = vi.fn().mockReturnValue({
      type: 'user.updated',
      data: { id: 'user_1' },
    })
    vi.mocked(Webhook).mockImplementation(function(this: Record<string, unknown>) {
      this.verify = mockVerify
    } as unknown as typeof Webhook)
    vi.mocked(handleClerkWebhook).mockResolvedValue(undefined)
  })

  it('returns 200 on valid webhook event', async () => {
    const app = createApp()
    const res = await app.request('/webhooks/clerk', {
      method: 'POST',
      headers: validHeaders,
      body: JSON.stringify({ type: 'user.updated', data: {} }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(handleClerkWebhook).toHaveBeenCalledWith({
      type: 'user.updated',
      data: { id: 'user_1' },
    })
  })

  it('returns 400 when svix-id header missing', async () => {
    const app = createApp()
    const { 'svix-id': _, ...headersWithout } = validHeaders
    const res = await app.request('/webhooks/clerk', {
      method: 'POST',
      headers: headersWithout,
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Missing svix headers')
  })

  it('returns 400 when svix-timestamp header missing', async () => {
    const app = createApp()
    const { 'svix-timestamp': _, ...headersWithout } = validHeaders
    const res = await app.request('/webhooks/clerk', {
      method: 'POST',
      headers: headersWithout,
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
  })

  it('returns 400 when svix-signature header missing', async () => {
    const app = createApp()
    const { 'svix-signature': _, ...headersWithout } = validHeaders
    const res = await app.request('/webhooks/clerk', {
      method: 'POST',
      headers: headersWithout,
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
  })

  it('returns 400 on signature verification failure', async () => {
    vi.mocked(Webhook).mockImplementation(function(this: Record<string, unknown>) {
      this.verify = vi.fn().mockImplementation(() => {
        throw new Error('Invalid signature: verification failed')
      })
    } as unknown as typeof Webhook)

    const app = createApp()
    const res = await app.request('/webhooks/clerk', {
      method: 'POST',
      headers: validHeaders,
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid signature')
  })

  it('returns 500 when handler throws (triggers Clerk retry)', async () => {
    vi.mocked(handleClerkWebhook).mockRejectedValueOnce(new Error('DB error'))

    const app = createApp()
    const res = await app.request('/webhooks/clerk', {
      method: 'POST',
      headers: validHeaders,
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Processing failed')
  })
})
