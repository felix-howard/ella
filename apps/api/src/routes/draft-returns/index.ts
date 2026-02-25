/**
 * Draft Return Routes (Workspace - Authenticated)
 * Upload, manage, and share draft tax returns with clients
 */
import { Hono } from 'hono'
import { prisma } from '../../lib/db'
import { uploadFile, getSignedDownloadUrl } from '../../services/storage'
import { PORTAL_URL } from '../../lib/constants'
import { buildNestedClientScope } from '../../lib/org-scope'
import type { AuthVariables } from '../../middleware/auth'

const DRAFT_RETURN_EXPIRY_DAYS = 14

// PDF magic bytes: %PDF
const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46])

/**
 * Sanitize filename to prevent path traversal and XSS
 */
function sanitizeFilename(filename: string): string {
  // Remove path components and dangerous characters
  return filename
    .replace(/[/\\]/g, '_') // Replace path separators
    .replace(/[<>:"|?*]/g, '_') // Remove Windows reserved chars
    .replace(/\.\./g, '_') // Prevent directory traversal
    .replace(/[\x00-\x1f]/g, '') // Remove control characters
    .trim()
    .slice(0, 255) // Limit length
}

/**
 * Verify buffer starts with PDF magic bytes
 */
function isPdfBuffer(buffer: Buffer): boolean {
  if (buffer.length < 4) return false
  return buffer.subarray(0, 4).equals(PDF_MAGIC_BYTES)
}

const draftReturnsRoute = new Hono<{ Variables: AuthVariables }>()

/**
 * POST /draft-returns/:caseId/upload
 * Upload PDF and create draft return with magic link
 */
draftReturnsRoute.post('/:caseId/upload', async (c) => {
  const caseId = c.req.param('caseId')
  const user = c.get('user')
  const staffId = user.staffId

  if (!staffId) {
    return c.json({ error: 'STAFF_REQUIRED', message: 'Staff account required' }, 403)
  }

  // Verify case exists and belongs to user's org (org-scoped)
  const taxCase = await prisma.taxCase.findFirst({
    where: { id: caseId, ...buildNestedClientScope(user) },
    include: { client: true },
  })

  if (!taxCase) {
    return c.json({ error: 'CASE_NOT_FOUND', message: 'Tax case not found' }, 404)
  }

  // Parse multipart form
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return c.json({ error: 'NO_FILE', message: 'No PDF file provided' }, 400)
  }

  // Validate MIME type
  if (file.type !== 'application/pdf') {
    return c.json({ error: 'INVALID_TYPE', message: 'Only PDF files are allowed' }, 400)
  }

  // Validate file size (max 50MB for tax returns)
  const MAX_SIZE = 50 * 1024 * 1024
  if (file.size > MAX_SIZE) {
    return c.json({ error: 'FILE_TOO_LARGE', message: 'File exceeds 50MB limit' }, 400)
  }

  // Read buffer and verify PDF magic bytes
  const buffer = Buffer.from(await file.arrayBuffer())
  if (!isPdfBuffer(buffer)) {
    return c.json({ error: 'INVALID_PDF', message: 'File is not a valid PDF' }, 400)
  }

  // Sanitize filename
  const safeFilename = sanitizeFilename(file.name)

  // Use transaction for atomic version superseding to prevent race conditions
  const result = await prisma.$transaction(async (tx) => {
    // Get current version number (locked within transaction)
    const latestDraft = await tx.draftReturn.findFirst({
      where: { taxCaseId: caseId },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    const newVersion = (latestDraft?.version ?? 0) + 1

    // Mark previous versions as superseded
    await tx.draftReturn.updateMany({
      where: { taxCaseId: caseId, status: 'ACTIVE' },
      data: { status: 'SUPERSEDED' },
    })

    // Check if there's an existing magic link for this case (reuse token for version continuity)
    const existingMagicLink = await tx.magicLink.findFirst({
      where: { caseId, type: 'DRAFT_RETURN' },
      orderBy: { createdAt: 'desc' },
      select: { token: true },
    })

    // Upload to R2 (outside transaction, but after we've locked the version)
    const timestamp = Date.now()
    const r2Key = `cases/${caseId}/draft-returns/${timestamp}.pdf`

    // Create draft return record
    const draftReturn = await tx.draftReturn.create({
      data: {
        taxCaseId: caseId,
        r2Key,
        filename: safeFilename,
        fileSize: file.size,
        version: newVersion,
        uploadedById: staffId,
        status: 'ACTIVE',
      },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
    })

    // Create or update magic link with 14-day expiry (reuse existing token if available)
    const expiresAt = new Date(Date.now() + DRAFT_RETURN_EXPIRY_DAYS * 24 * 60 * 60 * 1000)

    let magicLink
    if (existingMagicLink) {
      // Update existing magic link to point to new draft return (keeps same token/URL)
      magicLink = await tx.magicLink.update({
        where: { token: existingMagicLink.token },
        data: {
          draftReturnId: draftReturn.id,
          expiresAt,
          isActive: true,
        },
      })
    } else {
      // Create new magic link
      magicLink = await tx.magicLink.create({
        data: {
          caseId,
          type: 'DRAFT_RETURN',
          draftReturnId: draftReturn.id,
          expiresAt,
          isActive: true,
        },
      })
    }

    return { draftReturn, magicLink, r2Key }
  })

  // Upload to R2 after transaction succeeds
  await uploadFile(result.r2Key, buffer, 'application/pdf')

  const portalUrl = `${PORTAL_URL}/draft/${result.magicLink.token}`

  return c.json({
    draftReturn: {
      id: result.draftReturn.id,
      version: result.draftReturn.version,
      filename: result.draftReturn.filename,
      fileSize: result.draftReturn.fileSize,
      status: result.draftReturn.status,
      viewCount: result.draftReturn.viewCount,
      lastViewedAt: result.draftReturn.lastViewedAt?.toISOString() ?? null,
      uploadedAt: result.draftReturn.createdAt.toISOString(),
      uploadedBy: result.draftReturn.uploadedBy,
    },
    magicLink: {
      token: result.magicLink.token,
      url: portalUrl,
      expiresAt: result.magicLink.expiresAt?.toISOString() ?? null,
      isActive: result.magicLink.isActive,
      usageCount: result.magicLink.usageCount,
      lastUsedAt: result.magicLink.lastUsedAt?.toISOString() ?? null,
    },
    portalUrl,
  })
})

/**
 * GET /draft-returns/:caseId
 * Get current draft return and link status
 */
draftReturnsRoute.get('/:caseId', async (c) => {
  const caseId = c.req.param('caseId')
  const user = c.get('user')

  // Verify case belongs to user's org (org-scoped)
  const caseCheck = await prisma.taxCase.findFirst({
    where: { id: caseId, ...buildNestedClientScope(user) },
    select: { id: true },
  })

  if (!caseCheck) {
    return c.json({ error: 'CASE_NOT_FOUND', message: 'Tax case not found' }, 404)
  }

  // Get active draft return
  const draftReturn = await prisma.draftReturn.findFirst({
    where: { taxCaseId: caseId, status: 'ACTIVE' },
    include: {
      uploadedBy: { select: { id: true, name: true } },
    },
    orderBy: { version: 'desc' },
  })

  // Get active magic link
  const magicLink = draftReturn
    ? await prisma.magicLink.findFirst({
        where: { draftReturnId: draftReturn.id, isActive: true },
        orderBy: { createdAt: 'desc' },
      })
    : null

  // Get version history
  const versions = await prisma.draftReturn.findMany({
    where: { taxCaseId: caseId },
    select: { version: true, createdAt: true, status: true },
    orderBy: { version: 'desc' },
  })

  const portalUrl = magicLink ? `${PORTAL_URL}/draft/${magicLink.token}` : null

  return c.json({
    draftReturn: draftReturn
      ? {
          id: draftReturn.id,
          version: draftReturn.version,
          filename: draftReturn.filename,
          fileSize: draftReturn.fileSize,
          status: draftReturn.status,
          viewCount: draftReturn.viewCount,
          lastViewedAt: draftReturn.lastViewedAt?.toISOString() ?? null,
          uploadedAt: draftReturn.createdAt.toISOString(),
          uploadedBy: draftReturn.uploadedBy,
        }
      : null,
    magicLink: magicLink
      ? {
          token: magicLink.token,
          url: portalUrl,
          expiresAt: magicLink.expiresAt?.toISOString() ?? null,
          isActive: magicLink.isActive,
          usageCount: magicLink.usageCount,
          lastUsedAt: magicLink.lastUsedAt?.toISOString() ?? null,
        }
      : null,
    versions: versions.map((v) => ({
      version: v.version,
      uploadedAt: v.createdAt.toISOString(),
      status: v.status,
    })),
  })
})

/**
 * POST /draft-returns/:id/revoke
 * Revoke draft return link
 */
draftReturnsRoute.post('/:id/revoke', async (c) => {
  const id = c.req.param('id')
  const user = c.get('user')

  // Find draft return with its taxCase
  const draftReturn = await prisma.draftReturn.findUnique({
    where: { id },
    include: { taxCase: { select: { id: true } } },
  })

  if (!draftReturn) {
    return c.json({ error: 'NOT_FOUND', message: 'Draft return not found' }, 404)
  }

  // Verify the associated taxCase belongs to user's org
  const caseCheck = await prisma.taxCase.findFirst({
    where: { id: draftReturn.taxCaseId, ...buildNestedClientScope(user) },
    select: { id: true },
  })

  if (!caseCheck) {
    return c.json({ error: 'NOT_FOUND', message: 'Draft return not found' }, 404)
  }

  // Update draft status and deactivate magic link in transaction
  await prisma.$transaction([
    prisma.draftReturn.update({
      where: { id },
      data: { status: 'REVOKED' },
    }),
    prisma.magicLink.updateMany({
      where: { draftReturnId: id, isActive: true },
      data: { isActive: false },
    }),
  ])

  return c.json({ success: true })
})

/**
 * POST /draft-returns/:id/extend
 * Extend expiry by 14 days
 */
draftReturnsRoute.post('/:id/extend', async (c) => {
  const id = c.req.param('id')
  const user = c.get('user')

  // Find draft return
  const draftReturn = await prisma.draftReturn.findUnique({
    where: { id },
    select: { taxCaseId: true },
  })

  if (!draftReturn) {
    return c.json({ error: 'NOT_FOUND', message: 'Draft return not found' }, 404)
  }

  // Verify the associated taxCase belongs to user's org
  const caseCheck = await prisma.taxCase.findFirst({
    where: { id: draftReturn.taxCaseId, ...buildNestedClientScope(user) },
    select: { id: true },
  })

  if (!caseCheck) {
    return c.json({ error: 'NOT_FOUND', message: 'Draft return not found' }, 404)
  }

  // Use transaction to prevent race condition
  const newExpiry = new Date(Date.now() + DRAFT_RETURN_EXPIRY_DAYS * 24 * 60 * 60 * 1000)

  const updated = await prisma.$transaction(async (tx) => {
    const magicLink = await tx.magicLink.findFirst({
      where: { draftReturnId: id, isActive: true },
    })

    if (!magicLink) return null

    return tx.magicLink.update({
      where: { id: magicLink.id },
      data: { expiresAt: newExpiry },
    })
  })

  if (!updated) {
    return c.json({ error: 'NO_ACTIVE_LINK', message: 'No active link to extend' }, 400)
  }

  return c.json({
    success: true,
    expiresAt: newExpiry.toISOString(),
  })
})

/**
 * GET /draft-returns/:id/signed-url
 * Get signed URL to view/download draft return PDF
 */
draftReturnsRoute.get('/:id/signed-url', async (c) => {
  const id = c.req.param('id')
  const user = c.get('user')

  // Find draft return
  const draftReturn = await prisma.draftReturn.findUnique({
    where: { id },
    select: { r2Key: true, taxCaseId: true, filename: true },
  })

  if (!draftReturn) {
    return c.json({ error: 'NOT_FOUND', message: 'Draft return not found' }, 404)
  }

  // Verify the associated taxCase belongs to user's org
  const caseCheck = await prisma.taxCase.findFirst({
    where: { id: draftReturn.taxCaseId, ...buildNestedClientScope(user) },
    select: { id: true },
  })

  if (!caseCheck) {
    return c.json({ error: 'NOT_FOUND', message: 'Draft return not found' }, 404)
  }

  // Generate signed URL (15 min expiry for thumbnail/preview)
  const url = await getSignedDownloadUrl(draftReturn.r2Key, 900)

  if (!url) {
    return c.json({ error: 'PDF_UNAVAILABLE', message: 'Could not generate PDF URL' }, 500)
  }

  return c.json({ url, filename: draftReturn.filename })
})

/**
 * GET /draft-returns/version/:caseId/:version/signed-url
 * Get signed URL for a specific version of draft return
 */
draftReturnsRoute.get('/version/:caseId/:version/signed-url', async (c) => {
  const caseId = c.req.param('caseId')
  const versionStr = c.req.param('version')
  const version = parseInt(versionStr, 10)
  const user = c.get('user')

  if (isNaN(version) || version < 1) {
    return c.json({ error: 'INVALID_VERSION', message: 'Invalid version number' }, 400)
  }

  // Verify case belongs to user's org
  const caseCheck = await prisma.taxCase.findFirst({
    where: { id: caseId, ...buildNestedClientScope(user) },
    select: { id: true },
  })

  if (!caseCheck) {
    return c.json({ error: 'CASE_NOT_FOUND', message: 'Tax case not found' }, 404)
  }

  // Find the specific version
  const draftReturn = await prisma.draftReturn.findFirst({
    where: { taxCaseId: caseId, version },
    select: { r2Key: true, filename: true },
  })

  if (!draftReturn) {
    return c.json({ error: 'VERSION_NOT_FOUND', message: 'Version not found' }, 404)
  }

  // Generate signed URL (15 min expiry)
  const url = await getSignedDownloadUrl(draftReturn.r2Key, 900)

  if (!url) {
    return c.json({ error: 'PDF_UNAVAILABLE', message: 'Could not generate PDF URL' }, 500)
  }

  return c.json({ url, filename: draftReturn.filename })
})

export { draftReturnsRoute }
