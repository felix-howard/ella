/**
 * Lead → Client conversion: message-history preservation (Phase 10 / matrix row #6)
 *
 * Verifies that converting a lead with N messages:
 *   1. Calls tx.message.updateMany with { where:{leadId}, data:{conversationId, leadId:null} }
 *      — UPDATE (not copy) preserves message IDs and createdAt.
 *   2. Returns successful conversion response with clientId/engagementId.
 *
 * We're not testing the entire convert flow here (covered by integration/manual E2E);
 * we're pinning the critical migration semantics so a future refactor cannot silently
 * regress to "copy + delete" (which would break message IDs and break WS clients).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { updateManyMock, messageCreateMock } = vi.hoisted(() => ({
  updateManyMock: vi.fn(),
  messageCreateMock: vi.fn(),
}))

vi.mock('../../../lib/db', () => {
  // Build the tx object once so tests can reach into it from `updateManyMock`.
  const tx = {
    client: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: 'client_new',
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '+15551234567',
      }),
    },
    taxEngagement: {
      create: vi.fn().mockResolvedValue({ id: 'eng_1' }),
    },
    taxCase: {
      create: vi.fn().mockResolvedValue({ id: 'case_1' }),
    },
    conversation: {
      create: vi.fn().mockResolvedValue({ id: 'conv_1' }),
    },
    message: {
      updateMany: updateManyMock,
      // Exposed so we can assert it is NOT called — preserves "zero duplicates"
      // invariant: conversion must REASSIGN messages, never copy.
      create: messageCreateMock,
    },
    lead: {
      update: vi.fn().mockResolvedValue({ id: 'lead_1' }),
    },
  }
  return {
    prisma: {
      lead: {
        findFirst: vi.fn(),
      },
      organization: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb(tx)),
    },
  }
})

vi.mock('../../../services/sms', () => ({
  formatPhoneToE164: (p: string) => p,
  sendSmsOnly: vi.fn(),
  isTwilioConfigured: vi.fn().mockReturnValue(false), // skip welcome SMS path
  sendWelcomeMessage: vi.fn(),
}))

vi.mock('../../../services/magic-link', () => ({
  createMagicLink: vi.fn().mockResolvedValue('https://example/mag'),
}))

vi.mock('../../../lib/validation', () => ({
  sanitizeSearchInput: (s: string) => s,
  sanitizeTextInput: (s: string) => s,
}))

vi.mock('../../../middleware/rate-limiter', () => ({
  rateLimiter: () => async (_c: unknown, next: () => Promise<void>) => next(),
}))

vi.mock('../../../middleware/auth', () => {
  const authMiddleware = async (c: any, next: () => Promise<void>) => {
    if (!c.get('user')) {
      c.set('user', {
        id: 'clerk-1',
        staffId: 'staff_1',
        organizationId: 'org_1',
        role: 'ORG_ADMIN',
        orgRole: 'org:admin',
        email: 't@t.com',
        name: 'Tester',
        clerkOrgId: 'clerk_org_1',
      })
    }
    await next()
  }
  const requireOrgAdmin = async (_c: any, next: () => Promise<void>) => next()
  return { authMiddleware, requireOrgAdmin }
})

import { Hono } from 'hono'
import { prisma } from '../../../lib/db'
import { leadsRoute } from '../index'
import type { AuthVariables } from '../../../middleware/auth'

const VALID_LEAD_CUID = 'cmnldqbqa0005gf6cuecae3x1'

function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.route('/leads', leadsRoute)
  return app
}

beforeEach(() => {
  updateManyMock.mockReset()
  updateManyMock.mockResolvedValue({ count: 3 })
  messageCreateMock.mockReset()
})

describe('POST /leads/:id/convert — message history migration', () => {
  it('reassigns lead messages to new conversation via UPDATE (not copy)', async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce({
      id: VALID_LEAD_CUID,
      organizationId: 'org_1',
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '+15551234567',
      email: null,
      status: 'CONTACTED',
      tags: [],
    } as never)

    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/convert`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        language: 'EN',
        taxYear: 2025,
        sendWelcomeSms: false,
      }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as { success: boolean; clientId: string; engagementId: string }
    expect(body.success).toBe(true)
    expect(body.clientId).toBe('client_new')
    expect(body.engagementId).toBe('eng_1')

    // Critical: migration is an UPDATE that sets conversationId AND nulls leadId,
    // so Messages retain their original IDs + createdAt for continuous history.
    expect(updateManyMock).toHaveBeenCalledTimes(1)
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { leadId: VALID_LEAD_CUID },
      data: { conversationId: 'conv_1', leadId: null },
    })

    // Zero-duplicates invariant: conversion must NEVER also create new Message rows
    // (a "copy + delete" regression would silently double the conversation history).
    expect(messageCreateMock).not.toHaveBeenCalled()
  })

  it('rejects converting an already-CONVERTED lead', async () => {
    vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce({
      id: VALID_LEAD_CUID,
      organizationId: 'org_1',
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '+15551234567',
      email: null,
      status: 'CONVERTED',
      tags: [],
    } as never)

    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/convert`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ language: 'EN', taxYear: 2025, sendWelcomeSms: false }),
    })

    expect(res.status).toBe(400)
    expect(updateManyMock).not.toHaveBeenCalled()
  })
})
