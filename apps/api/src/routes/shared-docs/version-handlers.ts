/**
 * Version handlers: upload new version to existing section + signed URLs.
 */
import type { Context } from 'hono'
import { prisma } from '../../lib/db'
import { uploadFile, getSignedDownloadUrl } from '../../services/storage'
import type { AuthVariables } from '../../middleware/auth'
import {
  sanitizeFilename,
  isPdfBuffer,
  MAX_PDF_SIZE,
  sharedDocExpiryFromNow,
} from './validators'
import { buildPortalUrl, serializeDocument, serializeMagicLink } from './response-builders'
import { scopedDocWhere, requireParam } from './scope'

type AuthContext = Context<{ Variables: AuthVariables }>

/**
 * POST /shared-docs/:id/version
 * Upload new version to existing section.
 * - Current ACTIVE doc becomes SUPERSEDED
 * - New ACTIVE doc created with version+1, same title + taxCaseId
 * - Magic link token preserved (updated to point to new document id)
 */
export async function uploadVersion(c: AuthContext) {
  const id = requireParam(c, 'id')
  const user = c.get('user')
  const staffId = user.staffId
  if (!staffId) return c.json({ error: 'STAFF_REQUIRED', message: 'Staff account required' }, 403)

  const current = await prisma.shareableDocument.findFirst({
    where: { ...scopedDocWhere(user, id), status: 'ACTIVE' },
    select: { id: true, taxCaseId: true, title: true, version: true },
  })
  if (!current) return c.json({ error: 'NOT_FOUND', message: 'Section not found' }, 404)

  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  if (!file) return c.json({ error: 'NO_FILE', message: 'No PDF file provided' }, 400)
  if (file.type !== 'application/pdf') return c.json({ error: 'INVALID_TYPE', message: 'Only PDF files are allowed' }, 400)
  if (file.size > MAX_PDF_SIZE) return c.json({ error: 'FILE_TOO_LARGE', message: 'File exceeds 50MB limit' }, 400)

  const buffer = Buffer.from(await file.arrayBuffer())
  if (!isPdfBuffer(buffer)) return c.json({ error: 'INVALID_PDF', message: 'File is not a valid PDF' }, 400)

  const safeFilename = sanitizeFilename(file.name)
  const timestamp = Date.now()
  const r2Key = `cases/${current.taxCaseId}/draft-returns/${timestamp}.pdf`
  const expiresAt = sharedDocExpiryFromNow()

  const result = await prisma.$transaction(async (tx) => {
    await tx.shareableDocument.update({
      where: { id: current.id },
      data: { status: 'SUPERSEDED' },
    })

    const newDoc = await tx.shareableDocument.create({
      data: {
        taxCaseId: current.taxCaseId,
        title: current.title,
        r2Key,
        filename: safeFilename,
        fileSize: file.size,
        version: current.version + 1,
        uploadedById: staffId,
        status: 'ACTIVE',
      },
      include: { uploadedBy: { select: { id: true, name: true } } },
    })

    const existingLink = await tx.magicLink.findFirst({
      where: { draftReturnId: current.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })

    const magicLink = existingLink
      ? await tx.magicLink.update({
          where: { id: existingLink.id },
          data: { draftReturnId: newDoc.id, expiresAt, isActive: true },
        })
      : await tx.magicLink.create({
          data: {
            caseId: current.taxCaseId,
            type: 'DRAFT_RETURN',
            draftReturnId: newDoc.id,
            expiresAt,
            isActive: true,
          },
        })

    return { document: newDoc, magicLink }
  })

  await uploadFile(r2Key, buffer, 'application/pdf')

  return c.json({
    document: serializeDocument(result.document),
    magicLink: serializeMagicLink(result.magicLink),
    portalUrl: buildPortalUrl(result.magicLink.token),
  })
}

/**
 * GET /shared-docs/:id/signed-url
 * Signed URL for current version PDF.
 */
export async function getSignedUrl(c: AuthContext) {
  const id = requireParam(c, 'id')
  const user = c.get('user')

  const doc = await prisma.shareableDocument.findFirst({
    where: scopedDocWhere(user, id),
    select: { r2Key: true, filename: true },
  })
  if (!doc) return c.json({ error: 'NOT_FOUND', message: 'Section not found' }, 404)

  const url = await getSignedDownloadUrl(doc.r2Key, 900)
  if (!url) return c.json({ error: 'PDF_UNAVAILABLE', message: 'Could not generate PDF URL' }, 500)

  return c.json({ url, filename: doc.filename })
}

/**
 * GET /shared-docs/:id/version/:version/signed-url
 * Signed URL for a specific version within the same section.
 * Anchors section identity by (taxCaseId, title) and filters soft-deleted versions.
 */
export async function getVersionSignedUrl(c: AuthContext) {
  const id = requireParam(c, 'id')
  const versionStr = requireParam(c, 'version')
  const version = parseInt(versionStr, 10)
  const user = c.get('user')

  if (isNaN(version) || version < 1) {
    return c.json({ error: 'INVALID_VERSION', message: 'Invalid version number' }, 400)
  }

  const anchor = await prisma.shareableDocument.findFirst({
    where: scopedDocWhere(user, id),
    select: { taxCaseId: true, title: true },
  })
  if (!anchor) return c.json({ error: 'NOT_FOUND', message: 'Section not found' }, 404)

  const versionDoc = await prisma.shareableDocument.findFirst({
    where: {
      taxCaseId: anchor.taxCaseId,
      title: anchor.title,
      version,
      deletedAt: null,
    },
    select: { r2Key: true, filename: true },
  })
  if (!versionDoc) return c.json({ error: 'VERSION_NOT_FOUND', message: 'Version not found' }, 404)

  const url = await getSignedDownloadUrl(versionDoc.r2Key, 900)
  if (!url) return c.json({ error: 'PDF_UNAVAILABLE', message: 'Could not generate PDF URL' }, 500)

  return c.json({ url, filename: versionDoc.filename })
}
