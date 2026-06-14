import { Hono, type Context } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { ActivityRiskLevel, type Prisma, type StaffFile } from '@ella/db'
import { prisma } from '../../lib/db'
import type { AuthVariables } from '../../middleware/auth'
import {
  fetchFileBuffer,
  generateStaffFileKey,
  getStorageObjectMetadata,
  getSignedDownloadUrl,
  getSignedUploadUrl,
  SENSITIVE_DOC_SIGNED_URL_TTL_SECONDS,
} from '../../services/storage'
import { getAuditRequestContext, logStaffActivity } from '../../services/activity-log'
import { ACTIVITY_ACTIONS, ACTIVITY_CATEGORIES, ACTIVITY_TARGET_TYPES } from '../../services/activity-actions'
import {
  listStaffFilesQuerySchema,
  staffFileConfirmUploadSchema,
  staffFilePresignedUrlSchema,
  updateStaffFileSchema,
  updateStaffInvoiceStatusSchema,
} from './schemas'

const staffFilesRoute = new Hono<{ Variables: AuthVariables }>()
const ADMIN_ROLE = 'org:admin'

type StaffFileKind = 'PERSONAL_DOCUMENT' | 'INVOICE'
type StaffInvoiceStatus = 'SUBMITTED' | 'APPROVED' | 'PAID' | 'REJECTED'

function canAccessStaffFiles(user: AuthVariables['user'], targetStaffId: string): boolean {
  return targetStaffId === user.staffId || user.orgRole === ADMIN_ROLE || user.role === 'ADMIN'
}

function resolveTargetStaffId(user: AuthVariables['user'], staffId: string): string | null {
  return staffId === 'me' ? user.staffId : staffId
}

function invoiceMonthSegment(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function expectedUploadKeyPrefix(input: {
  organizationId: string
  staffId: string
  kind: StaffFileKind
  invoiceYear?: number
  invoiceMonth?: number
}): string {
  if (input.kind === 'INVOICE') {
    return `staff-files/${input.organizationId}/${input.staffId}/invoices/${invoiceMonthSegment(
      input.invoiceYear!,
      input.invoiceMonth!
    )}/`
  }
  return `staff-files/${input.organizationId}/${input.staffId}/documents/`
}

function serializeStaffFile(file: {
  id: string
  staffId: string
  uploadedByStaffId: string
  kind: StaffFileKind
  title: string
  category: string | null
  originalFilename: string
  mimeType: string
  fileSize: number
  checksumSha256: string | null
  invoiceYear: number | null
  invoiceMonth: number | null
  invoiceStatus: StaffInvoiceStatus | null
  replacedById: string | null
  isActive: boolean
  reviewedByStaffId: string | null
  reviewedAt: Date | null
  paidAt: Date | null
  adminNote: string | null
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: file.id,
    staffId: file.staffId,
    uploadedByStaffId: file.uploadedByStaffId,
    kind: file.kind,
    title: file.title,
    category: file.category,
    originalFilename: file.originalFilename,
    mimeType: file.mimeType,
    fileSize: file.fileSize,
    checksumSha256: file.checksumSha256,
    invoiceYear: file.invoiceYear,
    invoiceMonth: file.invoiceMonth,
    invoiceStatus: file.invoiceStatus,
    replacedById: file.replacedById,
    isActive: file.isActive,
    reviewedByStaffId: file.reviewedByStaffId,
    reviewedAt: file.reviewedAt?.toISOString() ?? null,
    paidAt: file.paidAt?.toISOString() ?? null,
    adminNote: file.adminNote,
    deletedAt: file.deletedAt?.toISOString() ?? null,
    createdAt: file.createdAt.toISOString(),
    updatedAt: file.updatedAt.toISOString(),
  }
}

function canTransitionInvoiceStatus(current: StaffInvoiceStatus | null, next: StaffInvoiceStatus): boolean {
  if (current === next) return true
  if (current === 'SUBMITTED') return next === 'APPROVED' || next === 'PAID' || next === 'REJECTED'
  if (current === 'APPROVED') return next === 'PAID' || next === 'REJECTED'
  return false
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
}

function normalizeContentType(contentType: string | null): string | null {
  return contentType?.split(';')[0]?.trim().toLowerCase() ?? null
}

function attachmentDisposition(filename: string): string {
  const fallback = filename.replace(/[^\w.-]/g, '_') || 'staff-file'
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

async function assertTargetStaff(organizationId: string, targetStaffId: string) {
  return prisma.staff.findFirst({
    where: { id: targetStaffId, organizationId },
    select: { id: true },
  })
}

async function logStaffFileActivity(
  c: Context<{ Variables: AuthVariables }>,
  user: AuthVariables['user'],
  file: { id: string; staffId: string; kind: StaffFileKind; invoiceYear?: number | null; invoiceMonth?: number | null },
  input: { summary: string; action: string; riskLevel?: ActivityRiskLevel; metadata?: Record<string, unknown> }
) {
  if (!user.staffId) return

  await logStaffActivity({
    organizationId: user.organizationId,
    actorStaffId: user.staffId,
    category: ACTIVITY_CATEGORIES.DOCUMENT,
    targetType: ACTIVITY_TARGET_TYPES.STAFF_FILE,
    targetId: file.id,
    summary: input.summary,
    action: input.action,
    riskLevel: input.riskLevel ?? ActivityRiskLevel.LOW,
    metadata: {
      staffId: file.staffId,
      kind: file.kind,
      invoiceYear: file.invoiceYear,
      invoiceMonth: file.invoiceMonth,
      ...input.metadata,
    },
    request: getAuditRequestContext(c),
  })
}

staffFilesRoute.post(
  '/members/:staffId/files/presigned-url',
  zValidator('json', staffFilePresignedUrlSchema),
  async (c) => {
    const user = c.get('user')
    const organizationId = user.organizationId
    if (!organizationId) return c.json({ error: 'Organization required' }, 403)

    const targetStaffId = resolveTargetStaffId(user, c.req.param('staffId'))
    if (!targetStaffId) return c.json({ error: 'Staff ID required' }, 400)
    if (!canAccessStaffFiles(user, targetStaffId)) return c.json({ error: 'Forbidden' }, 403)
    if (!(await assertTargetStaff(organizationId, targetStaffId))) return c.json({ error: 'Staff not found' }, 404)

    const input = c.req.valid('json')
    const uploadKey = generateStaffFileKey({
      organizationId,
      staffId: targetStaffId,
      kind: input.kind,
      filename: input.originalFilename,
      contentType: input.contentType,
      invoiceYear: input.invoiceYear,
      invoiceMonth: input.invoiceMonth,
    })
    const uploadUrl = await getSignedUploadUrl(uploadKey, input.contentType, input.fileSize)
    if (!uploadUrl) return c.json({ error: 'Storage not configured' }, 503)

    return c.json({ uploadUrl, uploadKey, expiresIn: 900 })
  }
)

staffFilesRoute.post(
  '/members/:staffId/files',
  zValidator('json', staffFileConfirmUploadSchema),
  async (c) => {
    const user = c.get('user')
    const organizationId = user.organizationId
    if (!organizationId) return c.json({ error: 'Organization required' }, 403)

    const targetStaffId = resolveTargetStaffId(user, c.req.param('staffId'))
    if (!targetStaffId) return c.json({ error: 'Staff ID required' }, 400)
    if (!canAccessStaffFiles(user, targetStaffId)) return c.json({ error: 'Forbidden' }, 403)
    if (!(await assertTargetStaff(organizationId, targetStaffId))) return c.json({ error: 'Staff not found' }, 404)

    const input = c.req.valid('json')
    const expectedPrefix = expectedUploadKeyPrefix({
      organizationId,
      staffId: targetStaffId,
      kind: input.kind,
      invoiceYear: input.invoiceYear,
      invoiceMonth: input.invoiceMonth,
    })
    if (!input.uploadKey.startsWith(expectedPrefix)) return c.json({ error: 'Invalid upload key' }, 400)

    const objectMetadata = await getStorageObjectMetadata(input.uploadKey)
    if (!objectMetadata) return c.json({ error: 'Uploaded file not found' }, 400)
    if (
      objectMetadata.contentLength !== input.fileSize ||
      normalizeContentType(objectMetadata.contentType) !== input.contentType
    ) {
      return c.json({ error: 'Uploaded file metadata mismatch' }, 400)
    }

    const createData: Prisma.StaffFileUncheckedCreateInput = {
      organizationId,
      staffId: targetStaffId,
      uploadedByStaffId: user.staffId ?? targetStaffId,
      kind: input.kind,
      title: input.title,
      category: input.category ?? null,
      originalFilename: input.originalFilename,
      mimeType: input.contentType,
      fileSize: input.fileSize,
      r2Key: input.uploadKey,
      checksumSha256: input.checksumSha256 ?? null,
      invoiceYear: input.kind === 'INVOICE' ? input.invoiceYear! : null,
      invoiceMonth: input.kind === 'INVOICE' ? input.invoiceMonth! : null,
      invoiceStatus: input.kind === 'INVOICE' ? 'SUBMITTED' : null,
      isActive: true,
    }

    let file: StaffFile
    try {
      file = input.kind === 'INVOICE'
        ? await prisma.$transaction(async (tx) => {
            const previousActive = await tx.staffFile.findMany({
              where: {
                organizationId,
                staffId: targetStaffId,
                kind: 'INVOICE',
                invoiceYear: input.invoiceYear,
                invoiceMonth: input.invoiceMonth,
                isActive: true,
                deletedAt: null,
              },
              select: { id: true, invoiceStatus: true },
            })
            if (previousActive.some((file) => file.invoiceStatus === 'PAID')) {
              throw new Error('PAID_INVOICE_REPLACEMENT_DENIED')
            }
            if (previousActive.length > 0) {
              const { count } = await tx.staffFile.updateMany({
                where: {
                  organizationId,
                  id: { in: previousActive.map((f) => f.id) },
                  isActive: true,
                  replacedById: null,
                  deletedAt: null,
                  invoiceStatus: { not: 'PAID' },
                },
                data: { isActive: false },
              })
              if (count !== previousActive.length) {
                throw new Error('INVOICE_REPLACEMENT_CONFLICT')
              }
            }
            const created = await tx.staffFile.create({ data: createData })
            if (previousActive.length > 0) {
              await tx.staffFile.updateMany({
                where: { organizationId, id: { in: previousActive.map((f) => f.id) } },
                data: { replacedById: created.id },
              })
            }
            return created
          })
        : await prisma.staffFile.create({ data: createData })
    } catch (error) {
      if (error instanceof Error && error.message === 'PAID_INVOICE_REPLACEMENT_DENIED') {
        return c.json({ error: 'Paid invoices cannot be replaced' }, 400)
      }
      if (error instanceof Error && error.message === 'INVOICE_REPLACEMENT_CONFLICT') {
        return c.json({ error: 'Invoice status changed, refresh and try again' }, 409)
      }
      if (input.kind === 'INVOICE' && isUniqueConstraintError(error)) {
        return c.json({ error: 'Active invoice already exists, refresh and try again' }, 409)
      }
      throw error
    }

    await logStaffFileActivity(c, user, file, {
      summary: input.kind === 'INVOICE' ? 'Uploaded staff invoice' : 'Uploaded staff document',
      action: ACTIVITY_ACTIONS.DOCUMENT.STAFF_FILE_UPLOADED,
      metadata: { uploadedSelf: targetStaffId === user.staffId },
    })

    return c.json({ success: true, file: serializeStaffFile(file) }, 201)
  }
)

staffFilesRoute.get('/members/:staffId/files', zValidator('query', listStaffFilesQuerySchema), async (c) => {
  const user = c.get('user')
  const organizationId = user.organizationId
  if (!organizationId) return c.json({ error: 'Organization required' }, 403)

  const targetStaffId = resolveTargetStaffId(user, c.req.param('staffId'))
  if (!targetStaffId) return c.json({ error: 'Staff ID required' }, 400)
  if (!canAccessStaffFiles(user, targetStaffId)) return c.json({ error: 'Forbidden' }, 403)
  if (!(await assertTargetStaff(organizationId, targetStaffId))) return c.json({ error: 'Staff not found' }, 404)

  const query = c.req.valid('query')
  const files = await prisma.staffFile.findMany({
    where: {
      organizationId,
      staffId: targetStaffId,
      deletedAt: null,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.year ? { invoiceYear: query.year } : {}),
      ...(query.month ? { invoiceMonth: query.month } : {}),
    },
    orderBy: [{ invoiceYear: 'desc' }, { invoiceMonth: 'desc' }, { createdAt: 'desc' }],
    take: query.limit,
  })

  return c.json({ data: files.map(serializeStaffFile) })
})

staffFilesRoute.get('/members/:staffId/files/:fileId/download-url', async (c) => {
  const user = c.get('user')
  const organizationId = user.organizationId
  if (!organizationId) return c.json({ error: 'Organization required' }, 403)

  const targetStaffId = resolveTargetStaffId(user, c.req.param('staffId'))
  if (!targetStaffId) return c.json({ error: 'Staff ID required' }, 400)
  if (!canAccessStaffFiles(user, targetStaffId)) return c.json({ error: 'Forbidden' }, 403)

  const file = await prisma.staffFile.findFirst({
    where: { id: c.req.param('fileId'), organizationId, staffId: targetStaffId, deletedAt: null },
  })
  if (!file) return c.json({ error: 'File not found' }, 404)

  const downloadUrl = await getSignedDownloadUrl(file.r2Key, SENSITIVE_DOC_SIGNED_URL_TTL_SECONDS)
  if (!downloadUrl) return c.json({ error: 'Storage not configured' }, 503)

  await logStaffFileActivity(c, user, file, {
    summary: 'Created staff file download URL',
    action: ACTIVITY_ACTIONS.DOCUMENT.STAFF_FILE_DOWNLOADED,
  })

  return c.json({ downloadUrl, expiresIn: SENSITIVE_DOC_SIGNED_URL_TTL_SECONDS })
})

staffFilesRoute.get('/members/:staffId/files/:fileId/download', async (c) => {
  const user = c.get('user')
  const organizationId = user.organizationId
  if (!organizationId) return c.json({ error: 'Organization required' }, 403)

  const targetStaffId = resolveTargetStaffId(user, c.req.param('staffId'))
  if (!targetStaffId) return c.json({ error: 'Staff ID required' }, 400)
  if (!canAccessStaffFiles(user, targetStaffId)) return c.json({ error: 'Forbidden' }, 403)

  const file = await prisma.staffFile.findFirst({
    where: { id: c.req.param('fileId'), organizationId, staffId: targetStaffId, deletedAt: null },
  })
  if (!file) return c.json({ error: 'File not found' }, 404)

  const buffer = await fetchFileBuffer(file.r2Key)
  if (!buffer) return c.json({ error: 'Storage not configured' }, 503)

  await logStaffFileActivity(c, user, file, {
    summary: 'Downloaded staff file',
    action: ACTIVITY_ACTIONS.DOCUMENT.STAFF_FILE_DOWNLOADED,
  })

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Disposition': attachmentDisposition(file.originalFilename),
      'Content-Length': String(buffer.byteLength),
      'Cache-Control': 'private, no-store, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
  })
})

staffFilesRoute.delete('/members/:staffId/files/:fileId', async (c) => {
  const user = c.get('user')
  const organizationId = user.organizationId
  if (!organizationId) return c.json({ error: 'Organization required' }, 403)

  const targetStaffId = resolveTargetStaffId(user, c.req.param('staffId'))
  if (!targetStaffId) return c.json({ error: 'Staff ID required' }, 400)
  if (!canAccessStaffFiles(user, targetStaffId)) return c.json({ error: 'Forbidden' }, 403)

  const file = await prisma.staffFile.findFirst({
    where: { id: c.req.param('fileId'), organizationId, staffId: targetStaffId, deletedAt: null },
  })
  if (!file) return c.json({ error: 'File not found' }, 404)
  if (targetStaffId === user.staffId && file.kind === 'INVOICE' && file.invoiceStatus === 'PAID') {
    return c.json({ error: 'Paid invoices cannot be deleted by staff' }, 400)
  }

  const selfDeletePaidGuard =
    targetStaffId === user.staffId
      ? { NOT: { kind: 'INVOICE' as const, invoiceStatus: 'PAID' as const } }
      : {}
  const { count } = await prisma.staffFile.updateMany({
    where: {
      id: file.id,
      organizationId,
      staffId: targetStaffId,
      deletedAt: null,
      ...selfDeletePaidGuard,
    },
    data: {
      deletedAt: new Date(),
      deletedByStaffId: user.staffId ?? targetStaffId,
      isActive: false,
    },
  })
  if (count !== 1) return c.json({ error: 'File status changed, refresh and try again' }, 409)

  const deleted = await prisma.staffFile.findFirst({
    where: { id: file.id, organizationId, staffId: targetStaffId },
  })
  if (!deleted) return c.json({ error: 'File not found' }, 404)

  await logStaffFileActivity(c, user, deleted, {
    summary: 'Deleted staff file',
    action: ACTIVITY_ACTIONS.DOCUMENT.STAFF_FILE_DELETED,
    riskLevel: ActivityRiskLevel.MEDIUM,
  })

  return c.json({ success: true, file: serializeStaffFile(deleted) })
})

staffFilesRoute.patch(
  '/members/:staffId/files/:fileId',
  zValidator('json', updateStaffFileSchema),
  async (c) => {
    const user = c.get('user')
    const organizationId = user.organizationId
    if (!organizationId) return c.json({ error: 'Organization required' }, 403)

    const targetStaffId = resolveTargetStaffId(user, c.req.param('staffId'))
    if (!targetStaffId) return c.json({ error: 'Staff ID required' }, 400)
    if (!canAccessStaffFiles(user, targetStaffId)) return c.json({ error: 'Forbidden' }, 403)

    const file = await prisma.staffFile.findFirst({
      where: { id: c.req.param('fileId'), organizationId, staffId: targetStaffId, deletedAt: null },
    })
    if (!file) return c.json({ error: 'File not found' }, 404)

    const input = c.req.valid('json')
    const updated = await prisma.staffFile.update({
      where: { id_organizationId: { id: file.id, organizationId } },
      data: { title: input.title },
    })

    await logStaffFileActivity(c, user, updated, {
      summary: 'Renamed staff file',
      action: ACTIVITY_ACTIONS.DOCUMENT.STAFF_FILE_RENAMED,
      metadata: { previousTitleLength: file.title.length, newTitleLength: updated.title.length },
    })

    return c.json({ success: true, file: serializeStaffFile(updated) })
  }
)

staffFilesRoute.patch(
  '/members/:staffId/files/:fileId/invoice-status',
  zValidator('json', updateStaffInvoiceStatusSchema),
  async (c) => {
    const user = c.get('user')
    const organizationId = user.organizationId
    if (!organizationId) return c.json({ error: 'Organization required' }, 403)

    if (user.orgRole !== ADMIN_ROLE && user.role !== 'ADMIN') return c.json({ error: 'Admin access required' }, 403)

    const targetStaffId = resolveTargetStaffId(user, c.req.param('staffId'))
    if (!targetStaffId) return c.json({ error: 'Staff ID required' }, 400)

    const input = c.req.valid('json')
    const file = await prisma.staffFile.findFirst({
      where: {
        id: c.req.param('fileId'),
        organizationId,
        staffId: targetStaffId,
        kind: 'INVOICE',
        isActive: true,
        replacedById: null,
        deletedAt: null,
      },
    })
    if (!file) return c.json({ error: 'Invoice not found' }, 404)
    if (!canTransitionInvoiceStatus(file.invoiceStatus, input.status)) {
      return c.json({ error: 'Invalid invoice status transition' }, 400)
    }

    const updateData = {
      invoiceStatus: input.status,
      reviewedByStaffId: input.status === 'SUBMITTED' ? null : user.staffId,
      reviewedAt: input.status === 'SUBMITTED' ? null : new Date(),
      ...(input.status === 'PAID' && !file.paidAt ? { paidAt: new Date() } : {}),
      adminNote: input.adminNote === undefined ? file.adminNote : input.adminNote,
    }
    const { count } = await prisma.staffFile.updateMany({
      where: {
        id: file.id,
        organizationId,
        invoiceStatus: file.invoiceStatus,
        paidAt: file.paidAt,
        isActive: file.isActive,
        replacedById: file.replacedById,
        deletedAt: null,
      },
      data: updateData,
    })
    if (count !== 1) return c.json({ error: 'Invoice status changed, refresh and try again' }, 409)

    const updated = await prisma.staffFile.findFirst({
      where: { id: file.id, organizationId, staffId: targetStaffId },
    })
    if (!updated) return c.json({ error: 'Invoice not found' }, 404)

    await logStaffFileActivity(c, user, updated, {
      summary: 'Updated staff invoice status',
      action: ACTIVITY_ACTIONS.DOCUMENT.STAFF_INVOICE_STATUS_UPDATED,
      riskLevel: ActivityRiskLevel.MEDIUM,
      metadata: { previousStatus: file.invoiceStatus, newStatus: input.status },
    })

    return c.json({ success: true, file: serializeStaffFile(updated) })
  }
)

export { staffFilesRoute }
