/**
 * Portal Draft Routes (Public)
 * Client access to view draft tax returns
 */
import { Hono } from 'hono'
import { prisma } from '../../lib/db'
import { getSignedDownloadUrl } from '../../services/storage'

const portalDraftRoute = new Hono()

/**
 * GET /portal/draft/:token
 * Validate token and return draft data with signed PDF URL
 */
portalDraftRoute.get('/:token', async (c) => {
  const token = c.req.param('token')

  // Find magic link
  const magicLink = await prisma.magicLink.findUnique({
    where: { token },
    include: {
      draftReturn: true,
      taxCase: {
        include: { client: true },
      },
    },
  })

  if (!magicLink) {
    return c.json({ error: 'INVALID_TOKEN', message: 'Link not found' }, 401)
  }

  if (magicLink.type !== 'DRAFT_RETURN') {
    return c.json({ error: 'INVALID_TOKEN_TYPE', message: 'Invalid link type' }, 401)
  }

  if (!magicLink.isActive) {
    return c.json({ error: 'LINK_REVOKED', message: 'This link has been revoked' }, 401)
  }

  if (magicLink.expiresAt && magicLink.expiresAt < new Date()) {
    return c.json({ error: 'LINK_EXPIRED', message: 'This link has expired' }, 401)
  }

  if (!magicLink.draftReturn) {
    return c.json({ error: 'DRAFT_NOT_FOUND', message: 'Draft return not found' }, 404)
  }

  // Generate signed URL (15 min expiry)
  const pdfUrl = await getSignedDownloadUrl(magicLink.draftReturn.r2Key, 900)

  if (!pdfUrl) {
    return c.json({ error: 'PDF_UNAVAILABLE', message: 'Could not load PDF' }, 500)
  }

  // Update usage stats on magic link
  await prisma.magicLink.update({
    where: { id: magicLink.id },
    data: {
      lastUsedAt: new Date(),
      usageCount: { increment: 1 },
    },
  })

  return c.json({
    clientName: magicLink.taxCase.client.name,
    clientLanguage: magicLink.taxCase.client.language,
    taxYear: magicLink.taxCase.taxYear,
    version: magicLink.draftReturn.version,
    filename: magicLink.draftReturn.filename,
    uploadedAt: magicLink.draftReturn.createdAt.toISOString(),
    pdfUrl,
  })
})

/**
 * POST /portal/draft/:token/viewed
 * Track when client views the PDF
 */
portalDraftRoute.post('/:token/viewed', async (c) => {
  const token = c.req.param('token')

  const magicLink = await prisma.magicLink.findUnique({
    where: { token },
    select: { draftReturnId: true, isActive: true },
  })

  if (!magicLink || !magicLink.isActive || !magicLink.draftReturnId) {
    return c.json({ success: false }, 400)
  }

  await prisma.draftReturn.update({
    where: { id: magicLink.draftReturnId },
    data: {
      viewCount: { increment: 1 },
      lastViewedAt: new Date(),
    },
  })

  return c.json({ success: true })
})

export { portalDraftRoute }
