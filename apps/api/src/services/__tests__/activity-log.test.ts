import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { ActivityActorType, ActivityRiskLevel } from '@ella/db'

vi.mock('../../lib/db', () => ({
  prisma: {
    activityLog: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
  },
}))

import { prisma } from '../../lib/db'
import {
  getAuditRequestContext,
  getChangedFieldNames,
  logActivity,
  logClientPortalActivity,
  logStaffActivities,
  logStaffActivity,
  logSystemActivity,
  redactActivityMetadata,
  toActivityTimelineItem,
} from '../activity-log'
import { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES, ACTIVITY_TARGET_TYPES } from '../activity-actions'

describe('Activity Log', () => {
  const mockCreate = vi.mocked(prisma.activityLog.create)
  const mockCreateMany = vi.mocked(prisma.activityLog.createMany)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('redacts nested sensitive metadata keys', () => {
    const result = redactActivityMetadata({
      rawImageId: 'img_1',
      signedUrl: 'https://signed.example.com',
      nested: {
        r2Key: 'clients/private/file.pdf',
        safe: 'kept',
        taxPayerTin: '12-3456789',
      },
      pages: [
        { page: 1, ocrText: 'sensitive extracted text' },
        { page: 2, category: 'IDENTITY' },
      ],
      ssn: '123-45-6789',
      phone: '+1 555 123 4567',
      email: 'client@example.com',
      messageBody: 'private message',
      smsMessage: 'private sms',
      text: 'private free text',
      notes: 'private notes',
      suspiciousValues: {
        genericValue: 'https://signed.example.com/file.pdf?X-Amz-Signature=abc',
        storagePath: 'cases/case_1/private-file.pdf',
        extracted: 'SSN 123-45-6789',
        bearer: 'Bearer abcdefghijklmnopqrstuvwxyz123456',
      },
    })

    expect(result).toEqual({
      rawImageId: 'img_1',
      nested: {
        safe: 'kept',
      },
      pages: [{ page: 1 }, { page: 2, category: 'IDENTITY' }],
      suspiciousValues: {
        genericValue: '[REDACTED]',
        storagePath: '[REDACTED]',
        extracted: '[REDACTED]',
        bearer: '[REDACTED]',
      },
    })
  })

  it('returns changed field names for defined payload values only', () => {
    expect(
      getChangedFieldNames({
        name: 'Firm',
        firmEmail: null,
        slug: undefined,
        missedCallTextBack: false,
      })
    ).toEqual(['name', 'firmEmail', 'missedCallTextBack'])
  })

  it('ignores invalid proxy IP headers in audit request context', async () => {
    const app = new Hono()
    let requestContext: ReturnType<typeof getAuditRequestContext> | undefined
    app.get('/audit-test', (c) => {
      requestContext = getAuditRequestContext(c)
      return c.json({ ok: true })
    })

    await app.request('/audit-test', {
      headers: {
        'cf-connecting-ip': 'not-an-ip',
        'x-real-ip': 'also-not-an-ip',
        'x-forwarded-for': 'bad-forwarded',
        'user-agent': 'Vitest',
      },
    })

    expect(requestContext).toEqual({
      ipAddress: 'unknown',
      userAgent: 'Vitest',
      route: '/audit-test',
      method: 'GET',
    })
  })

  it('creates a staff activity row with request context', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'activity_1' } as never)

    await logStaffActivity({
      organizationId: 'org_1',
      clientId: 'client_1',
      caseId: 'case_1',
      rawImageId: 'img_1',
      actorStaffId: 'staff_1',
      action: 'DOCUMENT_DOWNLOAD_URL_CREATED',
      riskLevel: ActivityRiskLevel.MEDIUM,
      category: ACTIVITY_CATEGORIES.DOCUMENT,
      targetType: ACTIVITY_TARGET_TYPES.RAW_IMAGE,
      targetId: 'img_1',
      targetLabel: 'W-2',
      summary: 'Created temporary document download URL',
      metadata: {
        rawImageId: 'img_1',
        docType: 'W2',
        signedUrl: 'https://do-not-store.example.com',
      },
      request: {
        ipAddress: '203.0.113.10',
        userAgent: 'Vitest',
        route: '/images/img_1/signed-url',
        method: 'GET',
      },
    })

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org_1',
        clientId: 'client_1',
        caseId: 'case_1',
        rawImageId: 'img_1',
        category: ACTIVITY_CATEGORIES.DOCUMENT,
        targetType: ACTIVITY_TARGET_TYPES.RAW_IMAGE,
        targetId: 'img_1',
        targetLabel: 'W-2',
        summary: 'Created temporary document download URL',
        actorType: ActivityActorType.STAFF,
        actorStaffId: 'staff_1',
        action: ACTIVITY_ACTIONS.DOCUMENT.SIGNED_URL_CREATED,
        riskLevel: ActivityRiskLevel.MEDIUM,
        metadata: {
          rawImageId: 'img_1',
          docType: 'W2',
        },
        ipAddress: '203.0.113.10',
        userAgent: 'Vitest',
        route: '/images/img_1/signed-url',
        method: 'GET',
      }),
    })
  })

  it('keeps safe identifier metadata while removing message content fields', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'activity_message' } as never)

    await logStaffActivity({
      organizationId: 'org_1',
      clientId: 'client_1',
      caseId: 'case_1',
      actorStaffId: 'staff_1',
      action: ACTIVITY_ACTIONS.MESSAGE.SENT,
      metadata: {
        messageId: 'msg_1',
        conversationId: 'conv_1',
        messageBody: 'private message body',
        smsMessage: 'private sms body',
      },
    })

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: {
          messageId: 'msg_1',
          conversationId: 'conv_1',
        },
      }),
    })
  })

  it('supports system activity with strict mode', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'activity_2' } as never)

    await logSystemActivity(
      {
        organizationId: 'org_1',
        action: 'RETENTION_JOB_STARTED',
        riskLevel: ActivityRiskLevel.HIGH,
      },
      { strict: true }
    )

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org_1',
        actorType: ActivityActorType.SYSTEM,
        actorStaffId: undefined,
        action: ACTIVITY_ACTIONS.SYSTEM.JOB_STARTED,
        category: ACTIVITY_CATEGORIES.SYSTEM,
        riskLevel: ActivityRiskLevel.HIGH,
      }),
    })
  })

  it('supports client portal activity wrapper', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'activity_3' } as never)

    await logClientPortalActivity({
      organizationId: 'org_1',
      clientId: 'client_1',
      action: ACTIVITY_ACTIONS.SYSTEM.RATE_LIMITED,
      riskLevel: ActivityRiskLevel.MEDIUM,
    })

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org_1',
        clientId: 'client_1',
        actorType: ActivityActorType.CLIENT_PORTAL,
        actorStaffId: undefined,
        action: ACTIVITY_ACTIONS.SYSTEM.RATE_LIMITED,
      }),
    })
  })

  it('creates staff activity rows in one batch', async () => {
    mockCreateMany.mockResolvedValueOnce({ count: 2 } as never)

    await logStaffActivities([
      {
        organizationId: 'org_1',
        actorStaffId: 'staff_1',
        action: ACTIVITY_ACTIONS.DOCUMENT.MARKED_VIEWED,
        metadata: { rawImageId: 'img_1' },
      },
      {
        organizationId: 'org_1',
        actorStaffId: 'staff_1',
        action: ACTIVITY_ACTIONS.DOCUMENT.MARKED_VIEWED,
        metadata: { rawImageId: 'img_2' },
      },
    ])

    expect(mockCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ actorType: ActivityActorType.STAFF, organizationId: 'org_1' }),
        expect.objectContaining({ actorType: ActivityActorType.STAFF, organizationId: 'org_1' }),
      ],
    })
  })

  it('does not throw on non-strict logging failures', async () => {
    mockCreate.mockRejectedValueOnce(new Error('database unavailable'))

    await expect(
      logActivity({
        actorType: ActivityActorType.STAFF,
        actorStaffId: 'staff_1',
        action: ACTIVITY_ACTIONS.DOCUMENT.MARKED_VIEWED,
      })
    ).resolves.not.toThrow()

    expect(console.error).toHaveBeenCalledWith(
      '[ActivityLog] Failed to log activity',
      expect.objectContaining({
        action: ACTIVITY_ACTIONS.DOCUMENT.MARKED_VIEWED,
        actorStaffId: 'staff_1',
      })
    )
  })

  it('maps activity rows to timeline items without metadata', () => {
    const item = toActivityTimelineItem({
      id: 'activity_1',
      action: ACTIVITY_ACTIONS.MESSAGE.SENT,
      category: ACTIVITY_CATEGORIES.MESSAGE,
      targetType: ACTIVITY_TARGET_TYPES.CONVERSATION,
      targetId: 'conversation_1',
      targetLabel: 'Client thread',
      summary: 'Sent SMS to Client thread',
      actorType: ActivityActorType.STAFF,
      actorStaffId: 'staff_1',
      riskLevel: ActivityRiskLevel.LOW,
      createdAt: new Date('2026-05-20T10:00:00.000Z'),
    })

    expect(item).toEqual({
      id: 'activity_1',
      action: ACTIVITY_ACTIONS.MESSAGE.SENT,
      category: ACTIVITY_CATEGORIES.MESSAGE,
      targetType: ACTIVITY_TARGET_TYPES.CONVERSATION,
      targetId: 'conversation_1',
      targetLabel: 'Client thread',
      summary: 'Sent SMS to Client thread',
      actorType: ActivityActorType.STAFF,
      actorStaffId: 'staff_1',
      riskLevel: ActivityRiskLevel.LOW,
      createdAt: '2026-05-20T10:00:00.000Z',
    })
  })

  it('falls back when timeline records contain invalid display contract values', () => {
    const item = toActivityTimelineItem({
      id: 'activity_2',
      action: ACTIVITY_ACTIONS.MESSAGE.RECEIVED,
      category: 'NOT_A_CATEGORY',
      targetType: 'NOT_A_TARGET',
      targetId: 'message_1',
      targetLabel: 'Client thread',
      summary: null,
      actorType: ActivityActorType.CLIENT_PORTAL,
      actorStaffId: null,
      riskLevel: ActivityRiskLevel.LOW,
      createdAt: new Date('2026-05-20T11:00:00.000Z'),
    })

    expect(item.category).toBe(ACTIVITY_CATEGORIES.MESSAGE)
    expect(item.targetType).toBe(ACTIVITY_TARGET_TYPES.UNKNOWN)
    expect(item.summary).toBe('message received')
  })
})
