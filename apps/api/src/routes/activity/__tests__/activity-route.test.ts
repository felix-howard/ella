import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { ActivityActorType, ActivityRiskLevel } from '@ella/db'
import type { AuthVariables } from '../../../middleware/auth'

vi.mock('../../../lib/db', () => ({
  prisma: {
    activityLog: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    client: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    taxCase: {
      findMany: vi.fn(),
    },
    staff: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('../../../services/storage', () => ({
  resolveAvatarUrl: vi.fn((url: string | null | undefined) => Promise.resolve(url ?? null)),
}))

import { prisma } from '../../../lib/db'
import { activityRoute } from '../index'

const mockActivityFindMany = vi.mocked(prisma.activityLog.findMany)
const mockActivityFindFirst = vi.mocked(prisma.activityLog.findFirst)
const mockClientFindFirst = vi.mocked(prisma.client.findFirst)
const mockClientFindMany = vi.mocked(prisma.client.findMany)
const mockTaxCaseFindMany = vi.mocked(prisma.taxCase.findMany)
const mockStaffFindMany = vi.mocked(prisma.staff.findMany)

function adminUser() {
  return {
    id: 'clerk_admin_1',
    staffId: 'staff_admin_1',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'ADMIN',
    organizationId: 'org_1',
    clerkOrgId: 'clerk_org_1',
    orgRole: 'org:admin',
  }
}

function staffUser() {
  return {
    id: 'clerk_staff_1',
    staffId: 'staff_1',
    email: 'staff@example.com',
    name: 'Staff User',
    role: 'STAFF',
    organizationId: 'org_1',
    clerkOrgId: 'clerk_org_1',
    orgRole: 'org:member',
  }
}

function buildApp(user = adminUser()) {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', user)
    await next()
  })
  app.route('/activity', activityRoute)
  return app
}

function activityRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'activity_1',
    action: 'message.sent',
    category: 'MESSAGE',
    targetType: 'CONVERSATION',
    targetId: 'conversation_1',
    targetLabel: 'Client thread',
    summary: 'Sent SMS to Client thread',
    actorType: ActivityActorType.STAFF,
    actorStaffId: 'staff_admin_1',
    riskLevel: ActivityRiskLevel.LOW,
    clientId: 'client_1',
    caseId: 'case_1',
    route: '/messages/send',
    method: 'POST',
    createdAt: new Date('2026-05-20T10:00:00.000Z'),
    metadata: { messageBody: 'must not leak' },
    ...overrides,
  }
}

describe('activity route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStaffFindMany.mockResolvedValue([])
  })

  it('returns admin recent activity without raw metadata or raw routes', async () => {
    mockActivityFindMany.mockResolvedValueOnce([
      activityRow({ route: '/portal/secret-token' }),
    ] as never)
    mockStaffFindMany.mockResolvedValueOnce([
      { id: 'staff_admin_1', name: 'Admin User', avatarUrl: 'https://avatar.test/admin.png' },
    ] as never)

    const res = await buildApp().request('/activity/recent?category=MESSAGE&riskLevel=LOW')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({
      data: [
        expect.objectContaining({
          id: 'activity_1',
          category: 'MESSAGE',
          summary: 'Sent SMS to Client thread',
          actor: {
            type: 'STAFF',
            staffId: 'staff_admin_1',
            name: 'Admin User',
            avatarUrl: 'https://avatar.test/admin.png',
          },
          target: {
            type: 'CONVERSATION',
            id: 'conversation_1',
            label: 'Client thread',
          },
        }),
      ],
      nextCursor: null,
    })
    expect(json.data[0].metadata).toBeUndefined()
    expect(json.data[0].route).toBeNull()
    expect(mockActivityFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: 'org_1',
        category: 'MESSAGE',
        riskLevel: 'LOW',
        action: { notIn: ['document.signed_url_created', 'document.file_proxied', 'lead.message_read'] },
      }),
      take: 21,
    }))
  })

  it('scopes staff recent activity to assigned clients and own non-client actions', async () => {
    mockClientFindMany.mockResolvedValueOnce([{ id: 'client_1' }] as never)
    mockActivityFindMany.mockResolvedValueOnce([] as never)

    const res = await buildApp(staffUser()).request('/activity/recent')

    expect(res.status).toBe(200)
    expect(mockClientFindMany).toHaveBeenCalledWith({
      where: { organizationId: 'org_1', managedById: 'staff_1' },
      select: { id: true },
    })
    expect(mockActivityFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: 'org_1',
        action: { notIn: ['document.signed_url_created', 'document.file_proxied', 'lead.message_read'] },
        OR: [
          { clientId: { in: ['client_1'] } },
          { clientId: null, caseId: null, actorStaffId: 'staff_1' },
        ],
      }),
    }))
    expect(mockTaxCaseFindMany).not.toHaveBeenCalled()
  })

  it('returns 404 for inaccessible client activity', async () => {
    mockClientFindFirst.mockResolvedValueOnce(null)

    const res = await buildApp(staffUser()).request('/activity/clients/client_2')
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json).toEqual({ error: 'NOT_FOUND', message: 'Client not found' })
    expect(mockActivityFindMany).not.toHaveBeenCalled()
  })

  it('returns client activity with cursor pagination', async () => {
    mockClientFindFirst.mockResolvedValueOnce({ id: 'client_1' } as never)
    mockTaxCaseFindMany.mockResolvedValueOnce([{ id: 'case_1' }] as never)
    mockActivityFindFirst.mockResolvedValueOnce({ id: 'activity_0' } as never)
    mockActivityFindMany.mockResolvedValueOnce([
      activityRow({ id: 'activity_1', category: 'DOCUMENT', action: 'document.updated' }),
      activityRow({ id: 'activity_2', category: 'DOCUMENT', action: 'document.deleted' }),
      activityRow({ id: 'activity_3', category: 'DOCUMENT', action: 'document.moved' }),
    ] as never)

    const res = await buildApp().request('/activity/clients/client_1?limit=2&cursor=activity_0&category=DOCUMENT')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
    expect(json.nextCursor).toBe('activity_2')
    expect(json.data[0].metadata).toBeUndefined()
    expect(mockActivityFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: 'org_1',
        category: 'DOCUMENT',
        action: { notIn: ['document.signed_url_created', 'document.file_proxied', 'lead.message_read'] },
        OR: [
          { clientId: 'client_1' },
          { targetType: 'CLIENT', targetId: 'client_1' },
          { caseId: { in: ['case_1'] } },
        ],
      }),
      cursor: { id: 'activity_0' },
      skip: 1,
      take: 3,
    }))
  })

  it('returns 400 for stale or out-of-scope cursors', async () => {
    mockClientFindFirst.mockResolvedValueOnce({ id: 'client_1' } as never)
    mockTaxCaseFindMany.mockResolvedValueOnce([{ id: 'case_1' }] as never)
    mockActivityFindFirst.mockResolvedValueOnce(null)

    const res = await buildApp().request('/activity/clients/client_1?cursor=stale_cursor')
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'INVALID_CURSOR', message: 'Invalid activity cursor' })
    expect(mockActivityFindMany).not.toHaveBeenCalled()
  })

  it('hydrates actor staff only inside caller organization', async () => {
    mockActivityFindMany.mockResolvedValueOnce([
      activityRow({ actorStaffId: 'staff_cross_org' }),
    ] as never)
    mockStaffFindMany.mockResolvedValueOnce([])

    const res = await buildApp().request('/activity/recent')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data[0].actor).toEqual({
      type: 'STAFF',
      staffId: 'staff_cross_org',
      name: null,
      avatarUrl: null,
    })
    expect(mockStaffFindMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['staff_cross_org'] },
        organizationId: 'org_1',
      },
      select: { id: true, name: true, avatarUrl: true },
    })
  })
})
