import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/db', () => ({
  prisma: {
    staff: { findFirst: vi.fn() },
    staffFile: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn((callback: (tx: unknown) => unknown) =>
      callback({
        staffFile: {
          create: vi.fn(),
          findMany: vi.fn(),
          updateMany: vi.fn(),
        },
      })
    ),
  },
}))

vi.mock('../../../services/storage', () => ({
  generateStaffFileKey: vi.fn(),
  fetchFileBuffer: vi.fn(),
  getSignedUploadUrl: vi.fn(),
  getSignedDownloadUrl: vi.fn(),
  getStorageObjectMetadata: vi.fn(),
  SENSITIVE_DOC_SIGNED_URL_TTL_SECONDS: 900,
  generateAvatarKey: vi.fn(),
  resolveAvatarUrl: vi.fn().mockImplementation((url: string | null) => Promise.resolve(url)),
}))

vi.mock('../../../lib/config', () => ({
  config: { workspaceUrl: 'http://localhost:5174' },
}))

vi.mock('../../../lib/clerk-client', () => ({
  clerkClient: { organizations: {}, users: { updateUser: vi.fn() } },
}))

vi.mock('../../../services/auth', () => ({
  deactivateStaff: vi.fn(),
}))

vi.mock('../../../services/audit-logger', () => ({
  logTeamAction: vi.fn(),
}))

vi.mock('../../../services/activity-log', () => ({
  getAuditRequestContext: vi.fn(() => ({
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
    route: '/team/test',
    method: 'POST',
  })),
  getChangedFieldNames: vi.fn(() => []),
  logStaffActivity: vi.fn(),
}))

vi.mock('../../../middleware/auth', () => ({
  requireOrg: async (_c: unknown, next: () => Promise<void>) => next(),
  requireOrgAdmin: async (
    c: {
      get: (key: string) => { orgRole?: string | null; role?: string | null }
      json: (body: unknown, status?: number) => Response
    },
    next: () => Promise<void>
  ) => {
    const user = c.get('user')
    if (user?.orgRole !== 'org:admin' && user?.role !== 'ADMIN') {
      return c.json({ error: 'Admin access required' }, 403)
    }
    return next()
  },
}))

import { Hono } from 'hono'
import { prisma } from '../../../lib/db'
import { logStaffActivity } from '../../../services/activity-log'
import {
  fetchFileBuffer,
  generateStaffFileKey,
  getSignedDownloadUrl,
  getSignedUploadUrl,
  getStorageObjectMetadata,
} from '../../../services/storage'
import type { AuthVariables } from '../../../middleware/auth'
import { teamRoute } from '../index'

function createApp(user = adminUser()) {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('user', user)
    await next()
  })
  app.route('/team', teamRoute)
  return app
}

function adminUser() {
  return {
    id: 'clerk_admin',
    staffId: 'staff_admin',
    email: 'admin@test.com',
    name: 'Admin',
    role: 'ADMIN',
    organizationId: 'org_1',
    clerkOrgId: 'org_clerk_1',
    orgRole: 'org:admin',
  }
}

function staffUser() {
  return {
    id: 'clerk_staff',
    staffId: 'staff_1',
    email: 'staff@test.com',
    name: 'Staff',
    role: 'STAFF',
    organizationId: 'org_1',
    clerkOrgId: 'org_clerk_1',
    orgRole: 'org:member',
  }
}

function staffFileRow(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-06-14T00:00:00.000Z')
  return {
    id: 'file_1',
    organizationId: 'org_1',
    staffId: 'staff_1',
    uploadedByStaffId: 'staff_1',
    kind: 'INVOICE',
    title: 'June invoice',
    category: null,
    originalFilename: 'invoice.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024,
    r2Key: 'staff-files/org_1/staff_1/invoices/2026-06/file.pdf',
    checksumSha256: null,
    invoiceYear: 2026,
    invoiceMonth: 6,
    invoiceStatus: 'SUBMITTED',
    replacedById: null,
    isActive: true,
    reviewedByStaffId: null,
    reviewedAt: null,
    paidAt: null,
    adminNote: null,
    deletedAt: null,
    deletedByStaffId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('Team staff file routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.staff.findFirst).mockResolvedValue({ id: 'staff_1' } as never)
    vi.mocked(getStorageObjectMetadata).mockResolvedValue({
      contentLength: 1024,
      contentType: 'application/pdf',
    })
  })

  it('forbids non-admin access to another staff member files', async () => {
    const app = createApp(staffUser())
    const res = await app.request('/team/members/staff_2/files')

    expect(res.status).toBe(403)
    expect(vi.mocked(prisma.staffFile.findMany)).not.toHaveBeenCalled()
  })

  it('creates a presigned upload URL for an allowed staff file', async () => {
    vi.mocked(generateStaffFileKey).mockReturnValueOnce('staff-files/org_1/staff_1/documents/file.pdf')
    vi.mocked(getSignedUploadUrl).mockResolvedValueOnce('https://upload.test')

    const app = createApp(staffUser())
    const res = await app.request('/team/members/me/files/presigned-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'PERSONAL_DOCUMENT',
        contentType: 'application/pdf',
        fileSize: 1024,
        originalFilename: 'license.pdf',
      }),
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      uploadUrl: 'https://upload.test',
      uploadKey: 'staff-files/org_1/staff_1/documents/file.pdf',
      expiresIn: 900,
    })
  })

  it('replaces the active invoice for the same staff month while keeping history', async () => {
    const previous = { id: 'old_invoice', invoiceStatus: 'SUBMITTED' }
    const created = staffFileRow({ id: 'new_invoice' })
    const tx = {
      staffFile: {
        findMany: vi.fn().mockResolvedValue([previous]),
        create: vi.fn().mockResolvedValue(created),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    }
    const transactionMock = prisma.$transaction as unknown as {
      mockImplementationOnce: (implementation: (callback: (txArg: typeof tx) => unknown) => Promise<unknown>) => void
    }
    transactionMock.mockImplementationOnce((callback) => Promise.resolve(callback(tx)))

    const app = createApp(staffUser())
    const res = await app.request('/team/members/me/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'INVOICE',
        title: 'June invoice',
        contentType: 'application/pdf',
        fileSize: 1024,
        originalFilename: 'invoice.pdf',
        invoiceYear: 2026,
        invoiceMonth: 6,
        uploadKey: 'staff-files/org_1/staff_1/invoices/2026-06/new.pdf',
      }),
    })

    expect(res.status).toBe(201)
    expect(tx.staffFile.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['old_invoice'] } }),
        data: { isActive: false },
      })
    )
    expect(tx.staffFile.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isActive: true }) }))
    expect(tx.staffFile.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['old_invoice'] } }),
        data: { replacedById: 'new_invoice' },
      })
    )
    expect(logStaffActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'document.staff_file_uploaded' })
    )
  })

  it('rejects replacing an active paid invoice', async () => {
    const tx = {
      staffFile: {
        findMany: vi.fn().mockResolvedValue([{ id: 'paid_invoice', invoiceStatus: 'PAID' }]),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
    }
    const transactionMock = prisma.$transaction as unknown as {
      mockImplementationOnce: (implementation: (callback: (txArg: typeof tx) => unknown) => Promise<unknown>) => void
    }
    transactionMock.mockImplementationOnce((callback) => Promise.resolve(callback(tx)))

    const app = createApp(staffUser())
    const res = await app.request('/team/members/me/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'INVOICE',
        title: 'Replacement invoice',
        contentType: 'application/pdf',
        fileSize: 1024,
        originalFilename: 'invoice.pdf',
        invoiceYear: 2026,
        invoiceMonth: 6,
        uploadKey: 'staff-files/org_1/staff_1/invoices/2026-06/replacement.pdf',
      }),
    })

    expect(res.status).toBe(400)
    expect(tx.staffFile.create).not.toHaveBeenCalled()
    expect(tx.staffFile.updateMany).not.toHaveBeenCalled()
  })

  it('rejects replacement when invoice status changes during confirmation', async () => {
    const tx = {
      staffFile: {
        findMany: vi.fn().mockResolvedValue([{ id: 'old_invoice', invoiceStatus: 'SUBMITTED' }]),
        create: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    }
    const transactionMock = prisma.$transaction as unknown as {
      mockImplementationOnce: (implementation: (callback: (txArg: typeof tx) => unknown) => Promise<unknown>) => void
    }
    transactionMock.mockImplementationOnce((callback) => Promise.resolve(callback(tx)))

    const app = createApp(staffUser())
    const res = await app.request('/team/members/me/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'INVOICE',
        title: 'June invoice',
        contentType: 'application/pdf',
        fileSize: 1024,
        originalFilename: 'invoice.pdf',
        invoiceYear: 2026,
        invoiceMonth: 6,
        uploadKey: 'staff-files/org_1/staff_1/invoices/2026-06/conflict.pdf',
      }),
    })

    expect(res.status).toBe(409)
    expect(tx.staffFile.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          invoiceStatus: { not: 'PAID' },
          isActive: true,
          replacedById: null,
        }),
      })
    )
    expect(tx.staffFile.create).not.toHaveBeenCalled()
  })

  it('returns conflict when a concurrent active invoice is created first', async () => {
    const tx = {
      staffFile: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockRejectedValue(Object.assign(new Error('Unique constraint'), { code: 'P2002' })),
        updateMany: vi.fn(),
      },
    }
    const transactionMock = prisma.$transaction as unknown as {
      mockImplementationOnce: (implementation: (callback: (txArg: typeof tx) => unknown) => Promise<unknown>) => void
    }
    transactionMock.mockImplementationOnce((callback) => Promise.resolve(callback(tx)))

    const app = createApp(staffUser())
    const res = await app.request('/team/members/me/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'INVOICE',
        title: 'June invoice',
        contentType: 'application/pdf',
        fileSize: 1024,
        originalFilename: 'invoice.pdf',
        invoiceYear: 2026,
        invoiceMonth: 6,
        uploadKey: 'staff-files/org_1/staff_1/invoices/2026-06/race.pdf',
      }),
    })

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'Active invoice already exists, refresh and try again' })
    expect(logStaffActivity).not.toHaveBeenCalled()
  })

  it('rejects confirm upload when key does not belong to the staff file prefix', async () => {
    const app = createApp(staffUser())
    const res = await app.request('/team/members/me/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'PERSONAL_DOCUMENT',
        title: 'License',
        contentType: 'application/pdf',
        fileSize: 1024,
        originalFilename: 'license.pdf',
        uploadKey: 'staff-files/org_1/staff_2/documents/file.pdf',
      }),
    })

    expect(res.status).toBe(400)
    expect(vi.mocked(prisma.staffFile.create)).not.toHaveBeenCalled()
  })

  it('rejects confirm upload when uploaded object is missing', async () => {
    vi.mocked(getStorageObjectMetadata).mockResolvedValueOnce(null)

    const app = createApp(staffUser())
    const res = await app.request('/team/members/me/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'PERSONAL_DOCUMENT',
        title: 'License',
        contentType: 'application/pdf',
        fileSize: 1024,
        originalFilename: 'license.pdf',
        uploadKey: 'staff-files/org_1/staff_1/documents/file.pdf',
      }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Uploaded file not found' })
    expect(vi.mocked(prisma.staffFile.create)).not.toHaveBeenCalled()
  })

  it('rejects confirm upload when uploaded object metadata does not match', async () => {
    vi.mocked(getStorageObjectMetadata).mockResolvedValueOnce({
      contentLength: 2048,
      contentType: 'application/pdf',
    })

    const app = createApp(staffUser())
    const res = await app.request('/team/members/me/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'PERSONAL_DOCUMENT',
        title: 'License',
        contentType: 'application/pdf',
        fileSize: 1024,
        originalFilename: 'license.pdf',
        uploadKey: 'staff-files/org_1/staff_1/documents/file.pdf',
      }),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Uploaded file metadata mismatch' })
    expect(vi.mocked(prisma.staffFile.create)).not.toHaveBeenCalled()
  })

  it('lists files for an admin viewing another staff member', async () => {
    vi.mocked(prisma.staffFile.findMany).mockResolvedValueOnce([staffFileRow()] as never)

    const app = createApp()
    const res = await app.request('/team/members/staff_1/files?kind=INVOICE&year=2026')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(vi.mocked(prisma.staffFile.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org_1',
          staffId: 'staff_1',
          deletedAt: null,
          kind: 'INVOICE',
          invoiceYear: 2026,
        }),
        take: 50,
      })
    )
  })

  it('prevents staff from deleting their paid invoice', async () => {
    vi.mocked(prisma.staffFile.findFirst).mockResolvedValueOnce(
      staffFileRow({ invoiceStatus: 'PAID' }) as never
    )

    const app = createApp(staffUser())
    const res = await app.request('/team/members/me/files/file_1', { method: 'DELETE' })

    expect(res.status).toBe(400)
    expect(vi.mocked(prisma.staffFile.updateMany)).not.toHaveBeenCalled()
  })

  it('rejects stale staff delete when invoice becomes paid before update', async () => {
    vi.mocked(prisma.staffFile.findFirst).mockResolvedValueOnce(
      staffFileRow({ invoiceStatus: 'SUBMITTED' }) as never
    )
    vi.mocked(prisma.staffFile.updateMany).mockResolvedValueOnce({ count: 0 } as never)

    const app = createApp(staffUser())
    const res = await app.request('/team/members/me/files/file_1', { method: 'DELETE' })

    expect(res.status).toBe(409)
    expect(vi.mocked(prisma.staffFile.updateMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          NOT: { kind: 'INVOICE', invoiceStatus: 'PAID' },
        }),
      })
    )
  })

  it('soft-deletes a staff file and logs redacted metadata', async () => {
    vi.mocked(prisma.staffFile.findFirst).mockResolvedValueOnce(staffFileRow({ kind: 'PERSONAL_DOCUMENT', invoiceStatus: null }) as never)
    vi.mocked(prisma.staffFile.updateMany).mockResolvedValueOnce({ count: 1 } as never)
    vi.mocked(prisma.staffFile.findFirst).mockResolvedValueOnce(
      staffFileRow({
        kind: 'PERSONAL_DOCUMENT',
        invoiceStatus: null,
        deletedAt: new Date('2026-06-14T02:00:00.000Z'),
      }) as never
    )

    const app = createApp(staffUser())
    const res = await app.request('/team/members/me/files/file_1', { method: 'DELETE' })

    expect(res.status).toBe(200)
    expect(vi.mocked(prisma.staffFile.updateMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedByStaffId: 'staff_1', isActive: false }),
      })
    )
    const activityPayload = vi.mocked(logStaffActivity).mock.calls.at(-1)?.[0] as { metadata?: Record<string, unknown> }
    expect(JSON.stringify(activityPayload.metadata)).not.toContain('staff-files/')
    expect(JSON.stringify(activityPayload.metadata)).not.toContain('invoice.pdf')
  })

  it('renames a staff file without logging filenames', async () => {
    vi.mocked(prisma.staffFile.findFirst).mockResolvedValueOnce(
      staffFileRow({ kind: 'PERSONAL_DOCUMENT', title: 'Old title', invoiceStatus: null }) as never
    )
    vi.mocked(prisma.staffFile.update).mockResolvedValueOnce(
      staffFileRow({ kind: 'PERSONAL_DOCUMENT', title: 'New title', invoiceStatus: null }) as never
    )

    const app = createApp(staffUser())
    const res = await app.request('/team/members/me/files/file_1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New title' }),
    })

    expect(res.status).toBe(200)
    expect(vi.mocked(prisma.staffFile.update)).toHaveBeenCalledWith({
      where: { id_organizationId: { id: 'file_1', organizationId: 'org_1' } },
      data: { title: 'New title' },
    })
    const activityPayload = vi.mocked(logStaffActivity).mock.calls.at(-1)?.[0] as { metadata?: Record<string, unknown> }
    expect(activityPayload).toMatchObject({ action: 'document.staff_file_renamed' })
    expect(JSON.stringify(activityPayload.metadata)).not.toContain('Old title')
    expect(JSON.stringify(activityPayload.metadata)).not.toContain('New title')
  })

  it('forbids non-admin invoice status mutation', async () => {
    const app = createApp(staffUser())
    const res = await app.request('/team/members/me/files/file_1/invoice-status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' }),
    })

    expect(res.status).toBe(403)
    expect(vi.mocked(prisma.staffFile.update)).not.toHaveBeenCalled()
  })

  it('allows admin to update invoice status', async () => {
    vi.mocked(prisma.staffFile.findFirst).mockResolvedValueOnce(staffFileRow() as never)
    vi.mocked(prisma.staffFile.updateMany).mockResolvedValueOnce({ count: 1 } as never)
    vi.mocked(prisma.staffFile.findFirst).mockResolvedValueOnce(
      staffFileRow({
        invoiceStatus: 'PAID',
        reviewedByStaffId: 'staff_admin',
        reviewedAt: new Date('2026-06-14T01:00:00.000Z'),
        paidAt: new Date('2026-06-14T01:00:00.000Z'),
      }) as never
    )

    const app = createApp()
    const res = await app.request('/team/members/staff_1/files/file_1/invoice-status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID', adminNote: 'Paid by ACH' }),
    })

    expect(res.status).toBe(200)
    expect(vi.mocked(prisma.staffFile.updateMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          invoiceStatus: 'SUBMITTED',
          paidAt: null,
          isActive: true,
          replacedById: null,
        }),
        data: expect.objectContaining({
          invoiceStatus: 'PAID',
          reviewedByStaffId: 'staff_admin',
          adminNote: 'Paid by ACH',
        }),
      })
    )
  })

  it('allows admin to clear invoice admin note', async () => {
    vi.mocked(prisma.staffFile.findFirst).mockResolvedValueOnce(staffFileRow({ adminNote: 'Needs review' }) as never)
    vi.mocked(prisma.staffFile.updateMany).mockResolvedValueOnce({ count: 1 } as never)
    vi.mocked(prisma.staffFile.findFirst).mockResolvedValueOnce(
      staffFileRow({
        invoiceStatus: 'APPROVED',
        reviewedByStaffId: 'staff_admin',
        reviewedAt: new Date('2026-06-14T01:00:00.000Z'),
        adminNote: null,
      }) as never
    )

    const app = createApp()
    const res = await app.request('/team/members/staff_1/files/file_1/invoice-status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'APPROVED', adminNote: null }),
    })

    expect(res.status).toBe(200)
    expect(vi.mocked(prisma.staffFile.updateMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ adminNote: null }),
      })
    )
  })

  it('rejects stale concurrent invoice status updates', async () => {
    vi.mocked(prisma.staffFile.findFirst).mockResolvedValueOnce(staffFileRow({ invoiceStatus: 'APPROVED' }) as never)
    vi.mocked(prisma.staffFile.updateMany).mockResolvedValueOnce({ count: 0 } as never)

    const app = createApp()
    const res = await app.request('/team/members/staff_1/files/file_1/invoice-status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' }),
    })

    expect(res.status).toBe(409)
    expect(vi.mocked(prisma.staffFile.findFirst)).toHaveBeenCalledTimes(1)
  })

  it('rejects invoice status regressions from paid', async () => {
    vi.mocked(prisma.staffFile.findFirst).mockResolvedValueOnce(
      staffFileRow({ invoiceStatus: 'PAID', paidAt: new Date('2026-06-14T01:00:00.000Z') }) as never
    )

    const app = createApp()
    const res = await app.request('/team/members/staff_1/files/file_1/invoice-status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'SUBMITTED' }),
    })

    expect(res.status).toBe(400)
    expect(vi.mocked(prisma.staffFile.update)).not.toHaveBeenCalled()
  })

  it('creates a signed download URL without exposing the storage key', async () => {
    vi.mocked(prisma.staffFile.findFirst).mockResolvedValueOnce(staffFileRow() as never)
    vi.mocked(getSignedDownloadUrl).mockResolvedValueOnce('https://download.test')

    const app = createApp(staffUser())
    const res = await app.request('/team/members/me/files/file_1/download-url')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ downloadUrl: 'https://download.test', expiresIn: 900 })
  })

  it('downloads a staff file as an attachment through the API', async () => {
    vi.mocked(prisma.staffFile.findFirst).mockResolvedValueOnce(staffFileRow({
      originalFilename: 'invoice june.pdf',
      mimeType: 'application/pdf',
    }) as never)
    vi.mocked(fetchFileBuffer).mockResolvedValueOnce(Buffer.from('pdf bytes'))

    const app = createApp(staffUser())
    const res = await app.request('/team/members/me/files/file_1/download')
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('content-disposition')).toContain('attachment')
    expect(res.headers.get('content-disposition')).toContain('invoice_june.pdf')
    expect(body).toBe('pdf bytes')
  })
})
