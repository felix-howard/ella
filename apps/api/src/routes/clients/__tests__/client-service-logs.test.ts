/**
 * Tests for staff-facing client service log endpoints.
 * Covers org/assignment scope, CRUD behavior, soft delete, and safe activity metadata.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { ClientServiceStatus, ClientServiceType } from '@ella/db'
import type { AuthVariables } from '../../../middleware/auth'

const prismaMocks = vi.hoisted(() => ({
  client: {
    findFirst: vi.fn(),
  },
  clientServiceLog: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
}))

const activityMocks = vi.hoisted(() => ({
  getAuditRequestContext: vi.fn(() => ({ route: '/clients/test/service-logs', method: 'POST' })),
  getChangedFieldNames: vi.fn((input: Record<string, unknown>) =>
    Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key)
  ),
  logStaffActivity: vi.fn(),
}))

vi.mock('../../../lib/db', () => ({ prisma: prismaMocks }))
vi.mock('../../../services/activity-log', () => activityMocks)

import { clientsServiceLogsRoute } from '../service-logs'
import { clientsRoute } from '../index'

const ORG_ID = 'org_1'
const CLIENT_ID = 'caaaaaaaaaaaaaaaaaaaaaaaa'
const SERVICE_LOG_ID = 'cbbbbbbbbbbbbbbbbbbbbbbbb'

function defaultUser(role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'CPA' = 'ADMIN') {
  return {
    id: `clerk_${role.toLowerCase()}`,
    staffId: `staff_${role.toLowerCase()}`,
    email: `${role.toLowerCase()}@test.com`,
    name: `${role} User`,
    role,
    organizationId: ORG_ID,
    clerkOrgId: 'org_clerk_1',
    orgRole: role === 'ADMIN' ? 'org:admin' : 'org:member',
  }
}

function buildApp(user = defaultUser()) {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', user)
    await next()
  })
  app.route('/clients', clientsServiceLogsRoute)
  return app
}

function serviceLogRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SERVICE_LOG_ID,
    organizationId: ORG_ID,
    clientId: CLIENT_ID,
    serviceType: ClientServiceType.INDIVIDUAL_TAX_RETURN,
    customServiceName: null,
    status: ClientServiceStatus.ACTIVE,
    taxYear: 2026,
    serviceDate: new Date('2026-07-01T12:00:00Z'),
    note: null,
    createdBy: { id: 'staff_admin', name: 'Admin User', avatarUrl: null },
    updatedBy: { id: 'staff_admin', name: 'Admin User', avatarUrl: null },
    createdAt: new Date('2026-07-01T12:00:00Z'),
    updatedAt: new Date('2026-07-02T12:00:00Z'),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMocks.client.findFirst.mockResolvedValue({ id: CLIENT_ID, organizationId: ORG_ID })
  prismaMocks.clientServiceLog.findMany.mockResolvedValue([])
  prismaMocks.clientServiceLog.findFirst.mockResolvedValue(serviceLogRow())
  prismaMocks.clientServiceLog.create.mockImplementation(async ({ data }) =>
    serviceLogRow({
      ...data,
      id: SERVICE_LOG_ID,
      createdAt: new Date('2026-07-03T12:00:00Z'),
      updatedAt: new Date('2026-07-03T12:00:00Z'),
    })
  )
  prismaMocks.clientServiceLog.updateMany.mockResolvedValue({ count: 1 })
  prismaMocks.clientServiceLog.update.mockImplementation(async ({ data }) =>
    serviceLogRow({
      ...data,
      updatedAt: new Date('2026-07-04T12:00:00Z'),
    })
  )
})

describe('GET /clients/:id/service-logs', () => {
  it('lists non-deleted service logs for an accessible client', async () => {
    prismaMocks.clientServiceLog.findMany.mockResolvedValueOnce([
      serviceLogRow({ note: 'Internal note' }),
    ])

    const res = await buildApp().request(`/clients/${CLIENT_ID}/service-logs?limit=50`)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMocks.client.findFirst).toHaveBeenCalledWith({
      where: { id: CLIENT_ID, organizationId: ORG_ID },
      select: { id: true, organizationId: true },
    })
    expect(prismaMocks.clientServiceLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clientId: CLIENT_ID, organizationId: ORG_ID, deletedAt: null },
        take: 50,
      })
    )
    expect(json.data[0]).toEqual(
      expect.objectContaining({
        id: SERVICE_LOG_ID,
        serviceDate: '2026-07-01T12:00:00.000Z',
        createdBy: { id: 'staff_admin', name: 'Admin User', avatarUrl: null },
      })
    )
  })

  it('is reachable through the fully mounted clients route', async () => {
    prismaMocks.clientServiceLog.findMany.mockResolvedValueOnce([serviceLogRow()])
    const app = new Hono<{ Variables: AuthVariables }>()
    app.use('*', async (c, next) => {
      c.set('user', defaultUser())
      await next()
    })
    app.route('/clients', clientsRoute)

    const res = await app.request(`/clients/${CLIENT_ID}/service-logs`)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(prismaMocks.clientServiceLog.findMany).toHaveBeenCalled()
  })

  it('returns 404 for a staff user without client assignment', async () => {
    prismaMocks.client.findFirst.mockResolvedValueOnce(null)

    const res = await buildApp(defaultUser('STAFF')).request(`/clients/${CLIENT_ID}/service-logs`)

    expect(res.status).toBe(404)
    expect(prismaMocks.client.findFirst).toHaveBeenCalledWith({
      where: {
        id: CLIENT_ID,
        organizationId: ORG_ID,
        managers: { some: { staffId: 'staff_staff' } },
      },
      select: { id: true, organizationId: true },
    })
    expect(prismaMocks.clientServiceLog.findMany).not.toHaveBeenCalled()
  })

  it('filters by service status when requested', async () => {
    await buildApp().request(
      `/clients/${CLIENT_ID}/service-logs?status=WAITING_ON_CLIENT,ACTIVE`
    )

    expect(prismaMocks.clientServiceLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: [ClientServiceStatus.WAITING_ON_CLIENT, ClientServiceStatus.ACTIVE] },
        }),
      })
    )
  })
})

describe('POST /clients/:id/service-logs', () => {
  it('creates a sanitized service log and writes safe activity metadata', async () => {
    const res = await buildApp().request(`/clients/${CLIENT_ID}/service-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceType: ClientServiceType.OTHER,
        customServiceName: ' <b>Quarterly Planning</b> ',
        status: ClientServiceStatus.WAITING_ON_CLIENT,
        taxYear: 2026,
        serviceDate: '2026-07-03',
        note: 'Need W-2 <script>alert(1)</script>',
      }),
    })
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.data.customServiceName).toBe('Quarterly Planning')
    expect(prismaMocks.clientServiceLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          clientId: CLIENT_ID,
          serviceType: ClientServiceType.OTHER,
          customServiceName: 'Quarterly Planning',
          note: 'Need W-2 alert(1)',
          createdById: 'staff_admin',
          updatedById: 'staff_admin',
        }),
      })
    )

    const activityInput = activityMocks.logStaffActivity.mock.calls[0][0]
    expect(activityInput.action).toBe('client.service_log_created')
    expect(activityInput.targetType).toBe('CLIENT_SERVICE_LOG')
    expect(activityInput.metadata).toEqual({
      serviceType: ClientServiceType.OTHER,
      status: ClientServiceStatus.WAITING_ON_CLIENT,
      taxYear: 2026,
    })
    expect(JSON.stringify(activityInput)).not.toContain('Need W-2')
    expect(JSON.stringify(activityInput)).not.toContain('Quarterly Planning')
  })

  it('rejects OTHER service type without a custom service name after sanitizing', async () => {
    const res = await buildApp().request(`/clients/${CLIENT_ID}/service-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceType: ClientServiceType.OTHER,
        customServiceName: '<b></b>',
        serviceDate: '2026-07-03',
      }),
    })

    expect(res.status).toBe(400)
    expect(prismaMocks.clientServiceLog.create).not.toHaveBeenCalled()
    expect(activityMocks.logStaffActivity).not.toHaveBeenCalled()
  })

  it('rejects creates without a service date', async () => {
    const res = await buildApp().request(`/clients/${CLIENT_ID}/service-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceType: ClientServiceType.BOOKKEEPING,
      }),
    })

    expect(res.status).toBe(400)
    expect(prismaMocks.clientServiceLog.create).not.toHaveBeenCalled()
  })

  it.each([
    '07/03/2026',
    '2026-02-29',
    '2026-07-03T12:00:00',
  ])('rejects invalid service date %s', async (serviceDate) => {
    const res = await buildApp().request(`/clients/${CLIENT_ID}/service-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceType: ClientServiceType.BOOKKEEPING,
        serviceDate,
      }),
    })

    expect(res.status).toBe(400)
    expect(prismaMocks.clientServiceLog.create).not.toHaveBeenCalled()
  })

  it('accepts timezone-qualified ISO datetimes', async () => {
    const res = await buildApp().request(`/clients/${CLIENT_ID}/service-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceType: ClientServiceType.BOOKKEEPING,
        serviceDate: '2026-07-03T12:00:00+07:00',
      }),
    })

    expect(res.status).toBe(201)
    expect(prismaMocks.clientServiceLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          serviceDate: new Date('2026-07-03T05:00:00.000Z'),
        }),
      })
    )
  })
})

describe('PATCH /clients/:id/service-logs/:serviceLogId', () => {
  it('updates an owned service log and does not log note body', async () => {
    prismaMocks.clientServiceLog.findFirst
      .mockResolvedValueOnce(serviceLogRow())
      .mockResolvedValueOnce(serviceLogRow({
        status: ClientServiceStatus.COMPLETED,
        note: 'private note',
        updatedAt: new Date('2026-07-05T12:00:00Z'),
      }))

    const res = await buildApp().request(`/clients/${CLIENT_ID}/service-logs/${SERVICE_LOG_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: ClientServiceStatus.COMPLETED,
        note: 'private <b>note</b>',
      }),
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.status).toBe(ClientServiceStatus.COMPLETED)
    expect(prismaMocks.clientServiceLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: SERVICE_LOG_ID,
          clientId: CLIENT_ID,
          organizationId: ORG_ID,
          deletedAt: null,
        },
      })
    )
    expect(prismaMocks.clientServiceLog.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: SERVICE_LOG_ID,
          clientId: CLIENT_ID,
          organizationId: ORG_ID,
          deletedAt: null,
        },
        data: expect.objectContaining({
          status: ClientServiceStatus.COMPLETED,
          note: 'private note',
          updatedById: 'staff_admin',
        }),
      })
    )

    const activityInput = activityMocks.logStaffActivity.mock.calls[0][0]
    expect(activityInput.action).toBe('client.service_log_updated')
    expect(activityInput.metadata.changedFields).toEqual(['status', 'note'])
    expect(JSON.stringify(activityInput)).not.toContain('private note')
  })

  it('returns 404 when the service log is deleted or outside the client org', async () => {
    prismaMocks.clientServiceLog.findFirst.mockResolvedValueOnce(null)

    const res = await buildApp().request(`/clients/${CLIENT_ID}/service-logs/${SERVICE_LOG_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: ClientServiceStatus.CANCELLED }),
    })

    expect(res.status).toBe(404)
    expect(prismaMocks.clientServiceLog.update).not.toHaveBeenCalled()
    expect(prismaMocks.clientServiceLog.updateMany).not.toHaveBeenCalled()
  })

  it('rejects invalid service dates on update', async () => {
    const res = await buildApp().request(`/clients/${CLIENT_ID}/service-logs/${SERVICE_LOG_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceDate: '2026-07-03T12:00:00' }),
    })

    expect(res.status).toBe(400)
    expect(prismaMocks.clientServiceLog.findFirst).not.toHaveBeenCalled()
    expect(prismaMocks.clientServiceLog.updateMany).not.toHaveBeenCalled()
  })

  it('returns 404 without activity when guarded update loses the active row race', async () => {
    prismaMocks.clientServiceLog.findFirst.mockResolvedValueOnce(serviceLogRow())
    prismaMocks.clientServiceLog.updateMany.mockResolvedValueOnce({ count: 0 })

    const res = await buildApp().request(`/clients/${CLIENT_ID}/service-logs/${SERVICE_LOG_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: ClientServiceStatus.CANCELLED }),
    })

    expect(res.status).toBe(404)
    expect(activityMocks.logStaffActivity).not.toHaveBeenCalled()
  })
})

describe('DELETE /clients/:id/service-logs/:serviceLogId', () => {
  it('soft-deletes a service log and logs safe metadata', async () => {
    const res = await buildApp().request(`/clients/${CLIENT_ID}/service-logs/${SERVICE_LOG_ID}`, {
      method: 'DELETE',
    })

    expect(res.status).toBe(200)
    expect(prismaMocks.clientServiceLog.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: SERVICE_LOG_ID,
          clientId: CLIENT_ID,
          organizationId: ORG_ID,
          deletedAt: null,
        },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
          deletedById: 'staff_admin',
          updatedById: 'staff_admin',
        }),
      })
    )

    const activityInput = activityMocks.logStaffActivity.mock.calls[0][0]
    expect(activityInput.action).toBe('client.service_log_deleted')
    expect(activityInput.metadata).toEqual({
      serviceType: ClientServiceType.INDIVIDUAL_TAX_RETURN,
      status: ClientServiceStatus.ACTIVE,
      taxYear: 2026,
    })
  })

  it('returns 404 without activity when guarded delete loses the active row race', async () => {
    prismaMocks.clientServiceLog.findFirst.mockResolvedValueOnce(serviceLogRow())
    prismaMocks.clientServiceLog.updateMany.mockResolvedValueOnce({ count: 0 })

    const res = await buildApp().request(`/clients/${CLIENT_ID}/service-logs/${SERVICE_LOG_ID}`, {
      method: 'DELETE',
    })

    expect(res.status).toBe(404)
    expect(activityMocks.logStaffActivity).not.toHaveBeenCalled()
  })
})
