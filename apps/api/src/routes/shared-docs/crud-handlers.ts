/**
 * CRUD handlers for shared-docs: create section, list, get, rename, soft delete.
 */
import type { Context } from 'hono'
import { prisma } from '../../lib/db'
import { uploadFile } from '../../services/storage'
import { buildNestedClientScope } from '../../lib/org-scope'
import type { AuthVariables } from '../../middleware/auth'
import type { AuthUser } from '../../services/auth'
import {
  validateTitle,
  sanitizeFilename,
  isPdfBuffer,
  ValidationError,
  MAX_PDF_SIZE,
  sharedDocExpiryFromNow,
} from './validators'
import { buildPortalUrl, serializeDocument, serializeMagicLink } from './response-builders'
import { scopedDocWhere } from './scope'

type AuthContext = Context<{ Variables: AuthVariables }>

/**
 * Look up a non-deleted document scoped to the caller's org, with uploader relation.
 */
async function findScopedDocument(user: AuthUser, id: string) {
  return prisma.shareableDocument.findFirst({
    where: scopedDocWhere(user, id),
    include: { uploadedBy: { select: { id: true, name: true } } },
  })
}

/**
 * Reject if another ACTIVE non-deleted section in the same case already has this title.
 * Pass `excludeId` when renaming to skip the current section's own row.
 */
async function assertTitleUnique(
  taxCaseId: string,
  title: string,
  excludeId?: string
): Promise<void> {
  const conflict = await prisma.shareableDocument.findFirst({
    where: {
      taxCaseId,
      title,
      deletedAt: null,
      status: 'ACTIVE',
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  })
  if (conflict) {
    throw new ValidationError('DUPLICATE_TITLE', 'Another section in this case already uses this title')
  }
}

/**
 * POST /shared-docs/:caseId
 * Create a new section (title + PDF). Always creates new document + new magic link.
 */
export async function createSection(c: AuthContext) {
  const caseId = c.req.param('caseId')
  const user = c.get('user')
  const staffId = user.staffId
  if (!staffId) return c.json({ error: 'STAFF_REQUIRED', message: 'Staff account required' }, 403)

  const taxCase = await prisma.taxCase.findFirst({
    where: { id: caseId, ...buildNestedClientScope(user) },
    select: { id: true },
  })
  if (!taxCase) return c.json({ error: 'CASE_NOT_FOUND', message: 'Tax case not found' }, 404)

  const formData = await c.req.formData()
  const rawTitle = formData.get('title')
  const file = formData.get('file') as File | null

  let title: string
  try {
    title = validateTitle(rawTitle)
    await assertTitleUnique(caseId, title)
  } catch (err) {
    if (err instanceof ValidationError) return c.json({ error: err.code, message: err.message }, err.status)
    throw err
  }

  if (!file) return c.json({ error: 'NO_FILE', message: 'No PDF file provided' }, 400)
  if (file.type !== 'application/pdf') return c.json({ error: 'INVALID_TYPE', message: 'Only PDF files are allowed' }, 400)
  if (file.size > MAX_PDF_SIZE) return c.json({ error: 'FILE_TOO_LARGE', message: 'File exceeds 50MB limit' }, 400)

  const buffer = Buffer.from(await file.arrayBuffer())
  if (!isPdfBuffer(buffer)) return c.json({ error: 'INVALID_PDF', message: 'File is not a valid PDF' }, 400)

  const safeFilename = sanitizeFilename(file.name)
  const timestamp = Date.now()
  const r2Key = `cases/${caseId}/draft-returns/${timestamp}.pdf`

  const result = await prisma.$transaction(async (tx) => {
    const document = await tx.shareableDocument.create({
      data: {
        taxCaseId: caseId,
        title,
        r2Key,
        filename: safeFilename,
        fileSize: file.size,
        version: 1,
        uploadedById: staffId,
        status: 'ACTIVE',
      },
      include: { uploadedBy: { select: { id: true, name: true } } },
    })

    const magicLink = await tx.magicLink.create({
      data: {
        caseId,
        type: 'DRAFT_RETURN',
        draftReturnId: document.id,
        expiresAt: sharedDocExpiryFromNow(),
        isActive: true,
      },
    })

    return { document, magicLink }
  })

  await uploadFile(r2Key, buffer, 'application/pdf')

  return c.json({
    document: serializeDocument(result.document),
    magicLink: serializeMagicLink(result.magicLink),
    portalUrl: buildPortalUrl(result.magicLink.token),
  })
}

/**
 * GET /shared-docs/case/:caseId
 * List all non-deleted sections (ACTIVE or REVOKED) for a case with their magic link if any.
 */
export async function listSections(c: AuthContext) {
  const caseId = c.req.param('caseId')
  const user = c.get('user')

  const taxCase = await prisma.taxCase.findFirst({
    where: { id: caseId, ...buildNestedClientScope(user) },
    select: { id: true },
  })
  if (!taxCase) return c.json({ error: 'CASE_NOT_FOUND', message: 'Tax case not found' }, 404)

  // Only one row per section is ACTIVE; SUPERSEDED rows are prior versions.
  // Revoked sections stay ACTIVE (link is disabled separately); soft-deleted rows are hidden via deletedAt.
  const docs = await prisma.shareableDocument.findMany({
    where: {
      taxCaseId: caseId,
      deletedAt: null,
      status: 'ACTIVE',
    },
    include: {
      uploadedBy: { select: { id: true, name: true } },
      magicLinks: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return c.json({
    documents: docs.map((doc) => ({
      ...serializeDocument(doc),
      magicLink: doc.magicLinks[0] ? serializeMagicLink(doc.magicLinks[0]) : null,
    })),
  })
}

/**
 * GET /shared-docs/:id
 * Get one section + its magic link + version history (same taxCase + title).
 * Rename propagates title to all versions, so title is a stable grouping key.
 */
export async function getSection(c: AuthContext) {
  const id = c.req.param('id')
  const user = c.get('user')

  const doc = await findScopedDocument(user, id)
  if (!doc) return c.json({ error: 'NOT_FOUND', message: 'Section not found' }, 404)

  const magicLink = await prisma.magicLink.findFirst({
    where: { draftReturnId: doc.id },
    orderBy: { createdAt: 'desc' },
  })

  const versions = await prisma.shareableDocument.findMany({
    where: { taxCaseId: doc.taxCaseId, title: doc.title, deletedAt: null },
    select: { version: true, createdAt: true, status: true },
    orderBy: { version: 'desc' },
  })

  return c.json({
    document: serializeDocument(doc),
    magicLink: magicLink ? serializeMagicLink(magicLink) : null,
    versions: versions.map((v) => ({
      version: v.version,
      uploadedAt: v.createdAt.toISOString(),
      status: v.status,
    })),
  })
}

/**
 * PATCH /shared-docs/:id
 * Rename section — updates title on ALL versions (active + superseded) in the same section
 * so (taxCaseId, title) remains a stable grouping key for version history.
 */
export async function renameSection(c: AuthContext) {
  const id = c.req.param('id')
  const user = c.get('user')

  const body = (await c.req.json().catch(() => ({}))) as { title?: unknown }

  const existing = await findScopedDocument(user, id)
  if (!existing) return c.json({ error: 'NOT_FOUND', message: 'Section not found' }, 404)

  let title: string
  try {
    title = validateTitle(body.title)
    if (title !== existing.title) {
      await assertTitleUnique(existing.taxCaseId, title, id)
    }
  } catch (err) {
    if (err instanceof ValidationError) return c.json({ error: err.code, message: err.message }, err.status)
    throw err
  }

  // Propagate rename to all versions (active + superseded) sharing the prior title.
  // Skip if title unchanged to avoid noop writes.
  if (title !== existing.title) {
    await prisma.shareableDocument.updateMany({
      where: { taxCaseId: existing.taxCaseId, title: existing.title, deletedAt: null },
      data: { title },
    })
  }

  const updated = await prisma.shareableDocument.findUniqueOrThrow({
    where: { id },
    include: { uploadedBy: { select: { id: true, name: true } } },
  })

  return c.json({ document: serializeDocument(updated) })
}

/**
 * DELETE /shared-docs/:id
 * Soft delete: set deletedAt + deactivate magic links. Idempotent.
 * (Status is left untouched — `deletedAt` alone signals "removed" across all queries.)
 */
export async function deleteSection(c: AuthContext) {
  const id = c.req.param('id')
  const user = c.get('user')

  const existing = await prisma.shareableDocument.findFirst({
    where: { id, taxCase: buildNestedClientScope(user) },
    select: { id: true, deletedAt: true },
  })
  if (!existing) return c.json({ error: 'NOT_FOUND', message: 'Section not found' }, 404)
  if (existing.deletedAt) return c.json({ success: true })

  await prisma.$transaction([
    prisma.shareableDocument.update({
      where: { id },
      data: { deletedAt: new Date() },
    }),
    prisma.magicLink.updateMany({
      where: { draftReturnId: id, isActive: true },
      data: { isActive: false },
    }),
  ])

  return c.json({ success: true })
}
