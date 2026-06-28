/**
 * Lead → Client conversion tests.
 *
 * Pins critical migration semantics so future refactors cannot silently regress:
 *   - Messages are REASSIGNED via UPDATE (preserves IDs + createdAt for WS clients).
 *   - Lead.notes is carried over to Client.notes.
 *   - All NDAs are linked to the new Client via clientId.
 *   - Phone duplicate is a HARD block (409) — no Client/NDA mutation persists.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  updateManyMock,
  messageFindFirstMock,
  messageCountMock,
  messageCreateMock,
  conversationCreateMock,
  agreementUpdateManyMock,
  actionUpdateManyMock,
  clientCreateMock,
  clientFindFirstMock,
  clientUpdateManyMock,
  clientManagerDeleteManyMock,
  clientManagerCreateManyMock,
  staffFindManyMock,
} = vi.hoisted(() => ({
  updateManyMock: vi.fn(),
  messageFindFirstMock: vi.fn(),
  messageCountMock: vi.fn(),
  messageCreateMock: vi.fn(),
  conversationCreateMock: vi.fn(),
  agreementUpdateManyMock: vi.fn(),
  actionUpdateManyMock: vi.fn(),
  clientCreateMock: vi.fn(),
  clientFindFirstMock: vi.fn(),
  clientUpdateManyMock: vi.fn(),
  clientManagerDeleteManyMock: vi.fn(),
  clientManagerCreateManyMock: vi.fn(),
  staffFindManyMock: vi.fn(),
}))

vi.mock('../../../lib/db', () => {
  const tx = {
    client: {
      findFirst: clientFindFirstMock,
      create: clientCreateMock,
      updateMany: clientUpdateManyMock,
    },
    clientManager: {
      deleteMany: clientManagerDeleteManyMock,
      createMany: clientManagerCreateManyMock,
    },
    staff: {
      findMany: staffFindManyMock,
    },
    taxEngagement: {
      create: vi.fn().mockResolvedValue({ id: 'eng_1' }),
    },
    taxCase: {
      create: vi.fn().mockResolvedValue({ id: 'case_1' }),
    },
    conversation: {
      create: conversationCreateMock,
    },
    message: {
      findFirst: messageFindFirstMock,
      count: messageCountMock,
      updateMany: updateManyMock,
      // Exposed to assert it is NOT called — preserves "zero duplicates"
      // invariant: conversion must REASSIGN messages, never copy.
      create: messageCreateMock,
    },
    agreement: {
      updateMany: agreementUpdateManyMock,
    },
    action: {
      updateMany: actionUpdateManyMock,
    },
    $executeRaw: vi.fn(),
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
  isTwilioConfigured: vi.fn().mockReturnValue(false),
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

vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: vi.fn(() => ({
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
    route: '/leads/test',
    method: 'POST',
  })),
  getChangedFieldNames: vi.fn((input: Record<string, unknown>) =>
    Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key)
  ),
  logStaffActivity: vi.fn(),
  logSystemActivity: vi.fn(),
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
  return { authMiddleware, requireOrgAdmin, requireAdminOrManager: requireOrgAdmin }
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

function mockLead(overrides: Record<string, unknown> = {}) {
  vi.mocked(prisma.lead.findFirst).mockResolvedValueOnce({
    id: VALID_LEAD_CUID,
    organizationId: 'org_1',
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '+15551234567',
    email: null,
    status: 'CONTACTED',
    tags: [],
    notes: null,
    ...overrides,
  } as never)
}

beforeEach(() => {
  updateManyMock.mockReset()
  updateManyMock.mockResolvedValue({ count: 3 })
  messageFindFirstMock.mockReset()
  messageFindFirstMock.mockResolvedValue({ createdAt: new Date('2026-04-24T10:00:00Z') })
  messageCountMock.mockReset()
  messageCountMock.mockResolvedValue(2)
  conversationCreateMock.mockReset()
  conversationCreateMock.mockResolvedValue({ id: 'conv_1' })
  agreementUpdateManyMock.mockReset()
  agreementUpdateManyMock.mockResolvedValue({ count: 0 })
  actionUpdateManyMock.mockReset()
  actionUpdateManyMock.mockResolvedValue({ count: 1 })
  messageCreateMock.mockReset()
  clientCreateMock.mockReset()
  clientCreateMock.mockResolvedValue({
    id: 'client_new',
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '+15551234567',
  })
  clientFindFirstMock.mockReset()
  clientFindFirstMock.mockResolvedValue(null)
  clientUpdateManyMock.mockReset()
  clientUpdateManyMock.mockResolvedValue({ count: 1 })
  clientManagerDeleteManyMock.mockReset()
  clientManagerDeleteManyMock.mockResolvedValue({ count: 0 })
  clientManagerCreateManyMock.mockReset()
  clientManagerCreateManyMock.mockResolvedValue({ count: 0 })
  staffFindManyMock.mockReset()
  staffFindManyMock.mockResolvedValue([])
})

describe('POST /leads/:id/convert — message history migration', () => {
  it('reassigns lead messages to new conversation via UPDATE (not copy)', async () => {
    mockLead()

    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/convert`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ language: 'EN', taxYear: 2025, sendWelcomeSms: false }),
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
    expect(conversationCreateMock).toHaveBeenCalledWith({
      data: {
        caseId: 'case_1',
        lastMessageAt: new Date('2026-04-24T10:00:00Z'),
        unreadCount: 2,
      },
    })
    expect(actionUpdateManyMock).toHaveBeenCalledWith({
      where: {
        leadId: VALID_LEAD_CUID,
        type: 'LEAD_REPLIED',
        isCompleted: false,
      },
      data: {
        isCompleted: true,
        completedAt: expect.any(Date),
      },
    })

    // Zero-duplicates invariant: conversion must NEVER also create new Message rows
    // (a "copy + delete" regression would silently double the conversation history).
    expect(messageCreateMock).not.toHaveBeenCalled()
  })

  it('rejects converting an already-CONVERTED lead', async () => {
    mockLead({ status: 'CONVERTED' })

    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/convert`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ language: 'EN', taxYear: 2025, sendWelcomeSms: false }),
    })

    expect(res.status).toBe(400)
    expect(updateManyMock).not.toHaveBeenCalled()
    expect(agreementUpdateManyMock).not.toHaveBeenCalled()
  })
})

describe('POST /leads/:id/convert — notes carry-over', () => {
  it('copies Lead.notes into Client.notes', async () => {
    const notes = 'Prefers SMS contact. Spouse is a CPA.'
    mockLead({ notes })

    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/convert`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ language: 'EN', taxYear: 2025, sendWelcomeSms: false }),
    })

    expect(res.status).toBe(200)
    expect(clientCreateMock).toHaveBeenCalledTimes(1)
    expect(clientCreateMock.mock.calls[0][0].data).toMatchObject({ notes })
  })

  it('handles null notes without error', async () => {
    mockLead({ notes: null })

    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/convert`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ language: 'EN', taxYear: 2025, sendWelcomeSms: false }),
    })

    expect(res.status).toBe(200)
    expect(clientCreateMock.mock.calls[0][0].data.notes).toBeNull()
  })
})

describe('POST /leads/:id/convert — NDA migration', () => {
  it('links all lead NDAs to the new client via updateMany', async () => {
    mockLead()
    agreementUpdateManyMock.mockResolvedValueOnce({ count: 2 })

    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/convert`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ language: 'EN', taxYear: 2025, sendWelcomeSms: false }),
    })

    expect(res.status).toBe(200)
    expect(agreementUpdateManyMock).toHaveBeenCalledTimes(1)
    expect(agreementUpdateManyMock).toHaveBeenCalledWith({
      where: { leadId: VALID_LEAD_CUID, organizationId: 'org_1' },
      data: { clientId: 'client_new' },
    })
  })
})

describe('POST /leads/:id/convert — duplicate phone hard-block', () => {
  it('returns 409 and does not migrate NDAs or create client', async () => {
    mockLead()
    clientFindFirstMock.mockResolvedValueOnce({
      id: 'client_existing',
      firstName: 'Jane',
      lastName: 'Doe',
    })

    const res = await buildApp().request(`/leads/${VALID_LEAD_CUID}/convert`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ language: 'EN', taxYear: 2025, sendWelcomeSms: false }),
    })

    expect(res.status).toBe(409)
    const body = (await res.json()) as { success: boolean; existingClient: { id: string } }
    expect(body.success).toBe(false)
    expect(body.existingClient.id).toBe('client_existing')

    // No mutations persisted on duplicate path.
    expect(clientCreateMock).not.toHaveBeenCalled()
    expect(updateManyMock).not.toHaveBeenCalled()
    expect(agreementUpdateManyMock).not.toHaveBeenCalled()
  })
})
