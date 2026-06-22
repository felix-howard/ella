import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../middleware/auth'

vi.mock('../../../lib/db', () => ({
  prisma: {
    staff: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

vi.mock('../../../services/storage', () => ({
  resolveAvatarUrl: vi.fn((url: string | null) => Promise.resolve(url)),
}))

vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: vi.fn(() => ({ route: '/staff/:staffId/intake-link', method: 'PATCH' })),
  getChangedFieldNames: vi.fn((input: Record<string, unknown>) =>
    Object.entries(input)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key)
  ),
  logStaffActivity: vi.fn(),
}))

import { prisma } from '../../../lib/db'
import { logStaffActivity } from '../../../services/activity-log'
import { staffRoute } from '../index'

function createApp(role: 'ADMIN' | 'MANAGER' | 'STAFF' = 'ADMIN') {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', {
      id: `user_${role.toLowerCase()}`,
      organizationId: 'org_1',
      staffId: `staff_${role.toLowerCase()}`,
      email: `${role.toLowerCase()}@example.com`,
      name: `${role} User`,
      role,
      clerkOrgId: 'clerk_org_1',
      orgRole: role === 'ADMIN' ? 'org:admin' : 'org:member',
    })
    await next()
  })
  app.route('/staff', staffRoute)
  return app
}

describe('PATCH /staff/:staffId/intake-link', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.staff.updateMany).mockResolvedValue({ count: 1 } as never)
  })

  it('lets admins update another active org staff with a scoped write and audit log', async () => {
    vi.mocked(prisma.staff.findFirst)
      .mockResolvedValueOnce({ id: 'staff_2' } as never)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'staff_2',
        formSlug: 'binh',
        useOrgUploadLinkDefaults: false,
        autoSendUploadLink: true,
        defaultUploadLinkTemplateId: 'tax-documents',
        defaultUploadLinkLanguage: 'VI',
      } as never)

    const res = await createApp('ADMIN').request('/staff/staff_2/intake-link', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formSlug: 'binh',
        useOrgUploadLinkDefaults: false,
        autoSendUploadLink: true,
        defaultUploadLinkTemplateId: 'tax-documents',
        defaultUploadLinkLanguage: 'VI',
      }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      id: 'staff_2',
      formSlug: 'binh',
      useOrgUploadLinkDefaults: false,
      autoSendUploadLink: true,
      defaultUploadLinkTemplateId: 'tax-documents',
      defaultUploadLinkLanguage: 'VI',
    })
    expect(prisma.staff.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'staff_2', organizationId: 'org_1', isActive: true },
      data: expect.objectContaining({
        formSlug: 'binh',
        useOrgUploadLinkDefaults: false,
        autoSendUploadLink: true,
      }),
    }))
    expect(logStaffActivity).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org_1',
      actorStaffId: 'staff_admin',
      targetId: 'staff_2',
      action: 'settings.staff_updated',
      metadata: expect.objectContaining({
        changedFields: [
          'formSlug',
          'useOrgUploadLinkDefaults',
          'autoSendUploadLink',
          'defaultUploadLinkTemplateId',
          'defaultUploadLinkLanguage',
        ],
      }),
    }))
  })

  it.each(['MANAGER', 'STAFF'] as const)('lets %s update own active staff intake link', async (role) => {
    const staffId = `staff_${role.toLowerCase()}`
    vi.mocked(prisma.staff.findFirst)
      .mockResolvedValueOnce({ id: staffId } as never)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: staffId,
        formSlug: `${role.toLowerCase()}-self`,
        useOrgUploadLinkDefaults: false,
        autoSendUploadLink: true,
        defaultUploadLinkTemplateId: 'tax-documents',
        defaultUploadLinkLanguage: 'VI',
      } as never)

    const res = await createApp(role).request(`/staff/${staffId}/intake-link`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formSlug: `${role.toLowerCase()}-self`,
        useOrgUploadLinkDefaults: false,
        autoSendUploadLink: true,
        defaultUploadLinkTemplateId: 'tax-documents',
        defaultUploadLinkLanguage: 'VI',
      }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      id: staffId,
      formSlug: `${role.toLowerCase()}-self`,
      useOrgUploadLinkDefaults: false,
      autoSendUploadLink: true,
      defaultUploadLinkTemplateId: 'tax-documents',
      defaultUploadLinkLanguage: 'VI',
    })
    expect(prisma.staff.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: staffId, organizationId: 'org_1', isActive: true },
      data: expect.objectContaining({
        formSlug: `${role.toLowerCase()}-self`,
        useOrgUploadLinkDefaults: false,
        autoSendUploadLink: true,
      }),
    }))
    expect(logStaffActivity).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org_1',
      actorStaffId: staffId,
      targetId: staffId,
      action: 'settings.staff_updated',
      metadata: expect.objectContaining({
        editedSelf: true,
      }),
    }))
  })

  it.each(['MANAGER', 'STAFF'] as const)('denies %s updates to another staff member before target lookup', async (role) => {
    const res = await createApp(role).request('/staff/staff_2/intake-link', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formSlug: 'Invalid Slug' }),
    })

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Admin access required' })
    expect(prisma.staff.findFirst).not.toHaveBeenCalled()
    expect(prisma.staff.updateMany).not.toHaveBeenCalled()
  })

  it('rejects cross-org or inactive staff targets', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce(null)

    const res = await createApp('ADMIN').request('/staff/staff_2/intake-link', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formSlug: 'binh' }),
    })

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Staff member not found' })
    expect(prisma.staff.updateMany).not.toHaveBeenCalled()
  })

  it('rejects duplicate staff form slugs in the organization', async () => {
    vi.mocked(prisma.staff.findFirst)
      .mockResolvedValueOnce({ id: 'staff_2' } as never)
      .mockResolvedValueOnce({ id: 'staff_3' } as never)

    const res = await createApp('ADMIN').request('/staff/staff_2/intake-link', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formSlug: 'binh' }),
    })

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: 'SLUG_TAKEN',
      message: 'This form slug is already in use by another staff member.',
    })
    expect(prisma.staff.updateMany).not.toHaveBeenCalled()
  })

  it('returns not found if scoped update loses the active org row', async () => {
    vi.mocked(prisma.staff.findFirst).mockResolvedValueOnce({ id: 'staff_2' } as never)
    vi.mocked(prisma.staff.updateMany).mockResolvedValueOnce({ count: 0 } as never)

    const res = await createApp('ADMIN').request('/staff/staff_2/intake-link', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ useOrgUploadLinkDefaults: true }),
    })

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Staff member not found' })
    expect(logStaffActivity).not.toHaveBeenCalled()
  })

  it('allows managers to clear their custom upload-link template to the backend default message', async () => {
    vi.mocked(prisma.staff.findFirst)
      .mockResolvedValueOnce({ id: 'staff_manager' } as never)
      .mockResolvedValueOnce({
        id: 'staff_manager',
        formSlug: 'manager',
        useOrgUploadLinkDefaults: false,
        autoSendUploadLink: true,
        defaultUploadLinkTemplateId: null,
        defaultUploadLinkLanguage: 'EN',
      } as never)

    const res = await createApp('MANAGER').request('/staff/staff_manager/intake-link', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        useOrgUploadLinkDefaults: false,
        defaultUploadLinkTemplateId: null,
      }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(expect.objectContaining({
      id: 'staff_manager',
      defaultUploadLinkTemplateId: null,
    }))
    expect(prisma.staff.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        useOrgUploadLinkDefaults: false,
        defaultUploadLinkTemplateId: null,
      }),
    }))
  })
})

describe('legacy staff intake mutation routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.staff.updateMany).mockResolvedValue({ count: 1 } as never)
  })

  it('allows staff to update their own legacy form slug with an active org-scoped write', async () => {
    vi.mocked(prisma.staff.findFirst)
      .mockResolvedValueOnce({ id: 'staff_staff' } as never)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'staff_staff', formSlug: 'staff-self' } as never)

    const res = await createApp('STAFF').request('/staff/me/form-slug', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formSlug: 'staff-self' }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'staff_staff', formSlug: 'staff-self' })
    expect(prisma.staff.updateMany).toHaveBeenCalledWith({
      where: { id: 'staff_staff', organizationId: 'org_1', isActive: true },
      data: { formSlug: 'staff-self' },
    })
    expect(prisma.staff.update).not.toHaveBeenCalled()
    expect(logStaffActivity).toHaveBeenCalledWith(expect.objectContaining({
      actorStaffId: 'staff_staff',
      targetId: 'staff_staff',
      metadata: {
        changedFields: ['formSlug'],
        editedSelf: true,
      },
    }))
  })

  it('denies manager updates to another staff legacy form slug before target lookup', async () => {
    const res = await createApp('MANAGER').request('/staff/staff_2/form-slug', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formSlug: 'Invalid Slug' }),
    })

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Admin access required' })
    expect(prisma.staff.findFirst).not.toHaveBeenCalled()
    expect(prisma.staff.updateMany).not.toHaveBeenCalled()
    expect(prisma.staff.update).not.toHaveBeenCalled()
    expect(logStaffActivity).not.toHaveBeenCalled()
  })

  it('denies non-manager staff updates to the legacy upload-link automation route', async () => {
    const res = await createApp('STAFF').request('/staff/me/auto-send-upload-link', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoSendUploadLink: true, defaultUploadLinkLanguage: 'VI' }),
    })

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Admin access required' })
    expect(prisma.staff.update).not.toHaveBeenCalled()
    expect(logStaffActivity).not.toHaveBeenCalled()
  })
})
