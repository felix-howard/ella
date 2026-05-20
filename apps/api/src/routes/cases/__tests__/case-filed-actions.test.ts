import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../middleware/auth'

const txMock = vi.hoisted(() => ({
  taxCase: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
}))

vi.mock('../../../lib/db', () => ({
  prisma: {
    taxCase: { findFirst: vi.fn() },
    $transaction: vi.fn((callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock)),
  },
}))

vi.mock('../../../services/identity-doc-retention', () => ({
  clearScheduledIdentityRetentionForCase: vi.fn(),
  extendScheduledIdentityRetentionForCase: vi.fn(),
  scheduleIdentityRetentionForFiledCase: vi.fn(),
}))
vi.mock('../../../lib/inngest', () => ({ inngest: { send: vi.fn() } }))
vi.mock('../../../services/checklist-generator', () => ({ generateChecklist: vi.fn() }))
vi.mock('../../../services/engagement-helpers', () => ({ findOrCreateEngagement: vi.fn() }))
vi.mock('../../../services/storage', () => ({
  SENSITIVE_DOC_SIGNED_URL_TTL_SECONDS: 900,
  getSignedDownloadUrl: vi.fn(),
}))
vi.mock('../../../services/activity-log', () => ({ getAuditRequestContext: vi.fn(), logStaffActivity: vi.fn() }))

import { prisma } from '../../../lib/db'
import {
  clearScheduledIdentityRetentionForCase,
  extendScheduledIdentityRetentionForCase,
  scheduleIdentityRetentionForFiledCase,
} from '../../../services/identity-doc-retention'
import { logStaffActivity } from '../../../services/activity-log'
import { casesRoute } from '../index'

const caseId = 'c123456789012345678901234'
const filedAt = new Date('2026-05-20T09:05:00.000Z')
const scopedCaseWhere = {
  id: caseId,
  client: { organizationId: 'org_1', managedById: 'staff_1' },
}
const actionSelect = { id: true, status: true, isFiled: true, filedAt: true }

const app = new Hono<{ Variables: AuthVariables }>()
app.use('*', async (c, next) => {
  c.set('user', {
    id: 'clerk_user_1',
    organizationId: 'org_1',
    staffId: 'staff_1',
    email: 'staff@example.com',
    name: 'Staff User',
    role: 'STAFF',
    clerkOrgId: 'clerk_org_1',
    orgRole: 'org:member',
  })
  await next()
})
app.route('/cases', casesRoute)

async function requestJson(path: string, init?: RequestInit) {
  const res = await app.request(path, init)
  return { res, json: await res.json() }
}

function mockTxCount(count: number, scopedCase: unknown = { id: caseId }) {
  txMock.taxCase.updateMany.mockResolvedValueOnce({ count } as never)
  if (count === 0) txMock.taxCase.findFirst.mockResolvedValueOnce(scopedCase as never)
}

describe('case filed action semantics', () => {
  const mockTaxCase = vi.mocked(prisma.taxCase)
  const mockTransaction = vi.mocked(prisma.$transaction)
  const mockScheduleRetention = vi.mocked(scheduleIdentityRetentionForFiledCase)
  const mockClearRetention = vi.mocked(clearScheduledIdentityRetentionForCase)
  const mockExtendRetention = vi.mocked(extendScheduledIdentityRetentionForCase)
  const mockLogStaffActivity = vi.mocked(logStaffActivity)

  beforeEach(() => {
    vi.clearAllMocks()
    txMock.taxCase.findFirst.mockReset()
    txMock.taxCase.findUnique.mockReset()
    txMock.taxCase.updateMany.mockReset()
    mockTransaction.mockImplementation((
      (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock)
    ) as never)
  })

  it('marks a non-review case filed and schedules identity doc retention', async () => {
    mockTxCount(1)
    txMock.taxCase.findUnique.mockResolvedValueOnce({
      id: caseId,
      status: 'FILED',
      isFiled: true,
      filedAt,
    } as never)
    mockScheduleRetention.mockResolvedValueOnce({ scheduled: 2 })

    const { res, json } = await requestJson(`/cases/${caseId}/mark-filed`, { method: 'POST' })

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true, caseId, status: 'FILED', isFiled: true, filedAt: '2026-05-20T09:05:00.000Z', scheduledIdentityDocs: 2 })
    expect(txMock.taxCase.updateMany).toHaveBeenCalledWith({
      where: { ...scopedCaseWhere, isFiled: false, status: { not: 'FILED' }, filedAt: null },
      data: {
        isFiled: true,
        isInReview: false,
        status: 'FILED',
        filedAt: expect.any(Date),
        lastActivityAt: expect.any(Date),
      },
    })
    expect(txMock.taxCase.findUnique).toHaveBeenCalledWith({
      where: { id: caseId },
      select: actionSelect,
    })
    expect(mockScheduleRetention).toHaveBeenCalledWith(caseId, txMock)
  })

  it('reopens a filed case to in progress and clears scheduled identity retention', async () => {
    mockTxCount(1)
    txMock.taxCase.findUnique.mockResolvedValueOnce({
      id: caseId,
      status: 'IN_PROGRESS',
      isFiled: false,
      filedAt: null,
    } as never)
    mockClearRetention.mockResolvedValueOnce({ cleared: 1 })

    const { res, json } = await requestJson(`/cases/${caseId}/reopen`, { method: 'POST' })

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true, caseId, status: 'IN_PROGRESS', isFiled: false, filedAt: null, clearedIdentityDocs: 1 })
    expect(txMock.taxCase.updateMany).toHaveBeenCalledWith({
      where: {
        ...scopedCaseWhere,
        OR: [{ isFiled: true }, { status: 'FILED' }, { filedAt: { not: null } }],
      },
      data: {
        isFiled: false,
        isInReview: false,
        status: 'IN_PROGRESS',
        filedAt: null,
        lastActivityAt: expect.any(Date),
      },
    })
    expect(mockClearRetention).toHaveBeenCalledWith(caseId, txMock)
  })

  it.each([
    ['mark-filed', 'ALREADY_FILED', mockScheduleRetention],
    ['reopen', 'NOT_FILED', mockClearRetention],
  ])('returns 400 when %s state predicate fails', async (action, error, retentionMock) => {
    mockTxCount(0)

    const { res, json } = await requestJson(`/cases/${caseId}/${action}`, { method: 'POST' })

    expect(res.status).toBe(400)
    expect(json.error).toBe(error)
    expect(retentionMock).not.toHaveBeenCalled()
  })

  it.each([
    ['mark-filed', mockScheduleRetention],
    ['reopen', mockClearRetention],
  ])('returns 404 and does not run retention when %s loses org scope', async (action, retentionMock) => {
    mockTxCount(0, null)

    const { res, json } = await requestJson(`/cases/${caseId}/${action}`, { method: 'POST' })

    expect(res.status).toBe(404)
    expect(json.error).toBe('NOT_FOUND')
    expect(retentionMock).not.toHaveBeenCalled()
  })

  it.each([
    ['REVIEW', 'FILED', mockScheduleRetention],
    ['FILED', 'REVIEW', mockClearRetention],
  ])('rejects PATCH filed transition %s to %s', async (currentStatus, nextStatus, retentionMock) => {
    mockTaxCase.findFirst.mockResolvedValueOnce({ status: currentStatus } as never)

    const { res, json } = await requestJson(`/cases/${caseId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })

    expect(res.status).toBe(400)
    expect(json.error).toBe('FILED_ACTION_REQUIRED')
    expect(mockTransaction).not.toHaveBeenCalled()
    expect(retentionMock).not.toHaveBeenCalled()
  })

  it('extends scheduled identity retention for a filed case and logs redacted audit metadata', async () => {
    txMock.taxCase.findFirst.mockResolvedValueOnce({
      id: caseId,
      clientId: 'client_1',
      status: 'FILED',
      isFiled: true,
      filedAt,
      client: { organizationId: 'org_1' },
    } as never)
    mockExtendRetention.mockResolvedValueOnce({
      scheduled: 2,
      extended: 1,
      extendedUntil: new Date('2026-06-19T09:05:00.000Z'),
      nextDeletionAt: new Date('2026-06-19T09:05:00.000Z'),
      latestDeletionAt: new Date('2026-07-20T09:05:00.000Z'),
    })

    const { res, json } = await requestJson(`/cases/${caseId}/identity-retention/extend`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ days: 30 }),
    })

    expect(res.status).toBe(200)
    expect(json).toEqual({
      success: true,
      caseId,
      days: 30,
      scheduledIdentityDocs: 2,
      extendedIdentityDocs: 1,
      extendedUntil: '2026-06-19T09:05:00.000Z',
      nextIdentityDeletionAt: '2026-06-19T09:05:00.000Z',
      latestIdentityDeletionAt: '2026-07-20T09:05:00.000Z',
    })
    expect(mockExtendRetention).toHaveBeenCalledWith(caseId, 30, txMock)
    expect(mockLogStaffActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        clientId: 'client_1',
        caseId,
        actorStaffId: 'staff_1',
        action: 'IDENTITY_DOCUMENT_RETENTION_EXTENDED',
        metadata: expect.objectContaining({
          days: 30,
          scheduledIdentityDocs: 2,
          extendedIdentityDocs: 1,
        }),
      })
    )
  })

  it('rejects identity retention extension for an unfiled case', async () => {
    txMock.taxCase.findFirst.mockResolvedValueOnce({
      id: caseId,
      clientId: 'client_1',
      status: 'IN_PROGRESS',
      isFiled: false,
      filedAt: null,
      client: { organizationId: 'org_1' },
    } as never)

    const { res, json } = await requestJson(`/cases/${caseId}/identity-retention/extend`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ days: 30 }),
    })

    expect(res.status).toBe(400)
    expect(json.error).toBe('CASE_NOT_FILED')
    expect(mockExtendRetention).not.toHaveBeenCalled()
  })
})
