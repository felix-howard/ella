import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthVariables } from '../../../middleware/auth'

const prismaMocks = vi.hoisted(() => ({
  taxCase: {
    findFirst: vi.fn(),
  },
  conversation: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  message: {
    create: vi.fn(),
  },
  staff: {
    findUnique: vi.fn(),
  },
}))

const voiceMocks = vi.hoisted(() => ({
  generateVoiceToken: vi.fn(),
  isVoiceConfigured: vi.fn(),
}))

const activityMocks = vi.hoisted(() => ({
  getAuditRequestContext: vi.fn(),
  logStaffActivity: vi.fn(),
}))

vi.mock('../../../lib/db', () => ({
  prisma: prismaMocks,
}))

vi.mock('../../../services/voice', () => ({
  generateVoiceToken: voiceMocks.generateVoiceToken,
  isVoiceConfigured: voiceMocks.isVoiceConfigured,
}))

vi.mock('../../../lib/inngest', () => ({
  inngest: { send: vi.fn(() => Promise.resolve()) },
}))

vi.mock('../../../middleware/rate-limiter', () => ({
  presenceHeartbeatRateLimit: async (_c: unknown, next: () => Promise<void>) => next(),
  presenceRegisterRateLimit: async (_c: unknown, next: () => Promise<void>) => next(),
  presenceUnregisterRateLimit: async (_c: unknown, next: () => Promise<void>) => next(),
}))

vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: activityMocks.getAuditRequestContext,
  logStaffActivity: activityMocks.logStaffActivity,
}))

import { voiceRoutes } from '../index'

const managerUser: AuthVariables['user'] = {
  id: 'clerk_manager',
  staffId: 'staff_manager',
  email: 'manager@example.test',
  name: 'Manager User',
  role: 'MANAGER',
  organizationId: 'org_1',
  clerkOrgId: 'org_clerk_1',
  orgRole: 'org:member',
}

function createApp(user: AuthVariables['user'] = managerUser) {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', user)
    await next()
  })
  app.route('/voice', voiceRoutes)
  return app
}

describe('voice routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    voiceMocks.isVoiceConfigured.mockReturnValue(true)
    activityMocks.getAuditRequestContext.mockReturnValue({
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
      route: '/voice/calls',
      method: 'POST',
    })
    activityMocks.logStaffActivity.mockResolvedValue(undefined)
    prismaMocks.taxCase.findFirst.mockResolvedValue({
      id: 'case_1',
      client: {
        id: 'client_1',
        organizationId: 'org_1',
        name: 'Andy Nguyen',
        firstName: 'Andy',
        lastName: 'Nguyen',
        phone: '+15555556234',
      },
    })
    prismaMocks.conversation.findUnique.mockResolvedValue(null)
    prismaMocks.conversation.create.mockResolvedValue({ id: 'conversation_1' })
    prismaMocks.conversation.update.mockResolvedValue({ id: 'conversation_1' })
    prismaMocks.message.create.mockResolvedValue({ id: 'message_1' })
    prismaMocks.staff.findUnique.mockResolvedValue({ name: 'Manager User' })
  })

  it('lets managers create outbound calls when the browser only has a masked phone', async () => {
    const res = await createApp().request('/voice/calls', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        caseId: 'case_1',
        toPhone: '*** *** 6234',
      }),
    })
    const body = await res.json() as { messageId: string; toPhone: string }

    expect(res.status).toBe(200)
    expect(body).toMatchObject({
      messageId: 'message_1',
      toPhone: '*** *** 6234',
    })
    expect(prismaMocks.taxCase.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: 'case_1',
        client: { organizationId: 'org_1' },
      },
    }))
    expect(prismaMocks.message.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        conversationId: 'conversation_1',
        channel: 'CALL',
        direction: 'OUTBOUND',
        content: 'Outgoing call',
        callStatus: 'initiated',
        sentById: 'staff_manager',
      }),
    }))
    expect(JSON.stringify(body)).not.toContain('+15555556234')
    expect(JSON.stringify(prismaMocks.message.create.mock.calls[0][0])).not.toContain('+15555556234')
  })

  it('rejects outbound calls when the stored client phone is not callable', async () => {
    prismaMocks.taxCase.findFirst.mockResolvedValueOnce({
      id: 'case_1',
      client: {
        id: 'client_1',
        organizationId: 'org_1',
        name: 'Andy Nguyen',
        phone: '*** *** 6234',
      },
    })

    const res = await createApp().request('/voice/calls', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ caseId: 'case_1', toPhone: '*** *** 6234' }),
    })

    expect(res.status).toBe(400)
    expect(prismaMocks.message.create).not.toHaveBeenCalled()
  })
})
