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
import { casesRoute } from '../index'

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

const caseId = 'c123456789012345678901234'
const now = new Date('2026-05-20T09:05:00.000Z')
const scopedCaseWhere = {
  id: caseId,
  client: { organizationId: 'org_1', managedById: 'staff_1' },
}

async function requestJson(path: string, init?: RequestInit) {
  const res = await app.request(path, init)
  return { res, json: await res.json() }
}

describe('case generic status transitions', () => {
  const mockTaxCase = vi.mocked(prisma.taxCase)

  beforeEach(() => {
    vi.clearAllMocks()
    txMock.taxCase.findFirst.mockReset()
    txMock.taxCase.findUnique.mockReset()
    txMock.taxCase.updateMany.mockReset()
  })

  it('uses a scoped conditional write for PATCH status changes', async () => {
    mockTaxCase.findFirst.mockResolvedValueOnce({ status: 'IN_PROGRESS' } as never)
    txMock.taxCase.updateMany.mockResolvedValueOnce({ count: 1 } as never)
    txMock.taxCase.findUnique.mockResolvedValueOnce({
      id: caseId,
      status: 'READY_FOR_ENTRY',
      createdAt: now,
      updatedAt: now,
    } as never)

    const { res, json } = await requestJson(`/cases/${caseId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'READY_FOR_ENTRY' }),
    })

    expect(res.status).toBe(200)
    expect(json.status).toBe('READY_FOR_ENTRY')
    expect(txMock.taxCase.updateMany).toHaveBeenCalledWith({
      where: { ...scopedCaseWhere, status: 'IN_PROGRESS' },
      data: { status: 'READY_FOR_ENTRY' },
    })
  })

  it('returns 409 when PATCH status changes after the preflight read', async () => {
    mockTaxCase.findFirst.mockResolvedValueOnce({ status: 'IN_PROGRESS' } as never)
    txMock.taxCase.updateMany.mockResolvedValueOnce({ count: 0 } as never)
    txMock.taxCase.findFirst.mockResolvedValueOnce({ status: 'WAITING_DOCS' } as never)

    const { res, json } = await requestJson(`/cases/${caseId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'READY_FOR_ENTRY' }),
    })

    expect(res.status).toBe(409)
    expect(json.error).toBe('STATUS_CHANGED')
    expect(json.currentStatus).toBe('WAITING_DOCS')
  })

  it.each([
    ['REVIEW', ['REVIEW', 'ENTRY_COMPLETE']],
    ['FILED', ['FILED']],
  ])('does not advertise filed transitions for %s', async (currentStatus, validTransitions) => {
    mockTaxCase.findFirst.mockResolvedValueOnce({ status: currentStatus } as never)

    const { res, json } = await requestJson(`/cases/${caseId}/valid-transitions`)

    expect(res.status).toBe(200)
    expect(json).toEqual({ currentStatus, validTransitions })
  })

  it('filters filed transitions from PATCH invalid-transition metadata', async () => {
    mockTaxCase.findFirst.mockResolvedValueOnce({ status: 'REVIEW' } as never)

    const { res, json } = await requestJson(`/cases/${caseId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'WAITING_DOCS' }),
    })

    expect(res.status).toBe(400)
    expect(json.error).toBe('INVALID_TRANSITION')
    expect(json.validTransitions).toEqual(['ENTRY_COMPLETE'])
  })
})
