/**
 * Terms & Conditions API routes
 * Staff acceptance flow with PDF storage and version tracking
 */
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { Prisma } from '@ella/db'
import { prisma } from '../../lib/db'
import { uploadFile, getSignedDownloadUrl } from '../../services/storage'
import { CURRENT_TERMS_VERSION } from '@ella/shared'
import type { AuthVariables } from '../../middleware/auth'
import { acceptTermsSchema, downloadParamsSchema } from './schemas'

const termsRoute = new Hono<{ Variables: AuthVariables }>()

// GET /terms/status - Check if staff accepted current version
termsRoute.get('/status', async (c) => {
  const user = c.get('user')
  if (!user.staffId) {
    return c.json({ error: 'Staff record not found' }, 404)
  }

  const acceptance = await prisma.termsAcceptance.findUnique({
    where: {
      staffId_version: {
        staffId: user.staffId,
        version: CURRENT_TERMS_VERSION,
      },
    },
    select: { version: true, signedAt: true },
  })

  return c.json({
    hasAccepted: !!acceptance,
    currentVersion: CURRENT_TERMS_VERSION,
    acceptedVersion: acceptance?.version,
    acceptedAt: acceptance?.signedAt?.toISOString(),
  })
})

// POST /terms/accept - Submit T&C acceptance with signed PDF
termsRoute.post('/accept', zValidator('json', acceptTermsSchema), async (c) => {
  const user = c.get('user')
  if (!user.staffId) {
    return c.json({ error: 'Staff record not found' }, 404)
  }

  const { version, pdfBase64 } = c.req.valid('json')

  if (version !== CURRENT_TERMS_VERSION) {
    return c.json({ error: 'VERSION_MISMATCH', message: 'Terms version outdated' }, 400)
  }

  // Decode PDF and upload to R2
  const pdfBuffer = Buffer.from(pdfBase64, 'base64')
  const r2Key = `terms/${user.organizationId}/${user.staffId}/${version}.pdf`

  try {
    await uploadFile(r2Key, pdfBuffer, 'application/pdf')
  } catch (error) {
    console.error('[Terms] PDF upload failed:', error)
    return c.json({ error: 'UPLOAD_FAILED', message: 'Failed to store signed PDF' }, 500)
  }

  // Capture IP and user agent server-side
  const ipAddress = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    || c.req.header('x-real-ip')
    || 'unknown'
  const userAgent = c.req.header('user-agent') || null

  try {
    const acceptance = await prisma.termsAcceptance.create({
      data: {
        staffId: user.staffId,
        version,
        pdfR2Key: r2Key,
        ipAddress,
        userAgent,
      },
      select: { id: true, version: true, signedAt: true },
    })

    return c.json({
      id: acceptance.id,
      version: acceptance.version,
      signedAt: acceptance.signedAt.toISOString(),
    }, 201)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return c.json({ error: 'ALREADY_ACCEPTED', message: 'Already accepted this version' }, 409)
    }
    throw error
  }
})

// GET /terms/download/:acceptanceId - Download signed PDF
termsRoute.get('/download/:acceptanceId', zValidator('param', downloadParamsSchema), async (c) => {
  const user = c.get('user')
  if (!user.staffId) {
    return c.json({ error: 'Staff record not found' }, 404)
  }

  const { acceptanceId } = c.req.valid('param')

  const acceptance = await prisma.termsAcceptance.findUnique({
    where: { id: acceptanceId },
    include: { staff: { select: { id: true, organizationId: true } } },
  })

  if (!acceptance) {
    return c.json({ error: 'NOT_FOUND', message: 'Acceptance record not found' }, 404)
  }

  // Staff can download own; admin can download any in same org
  const isOwner = acceptance.staffId === user.staffId
  const isOrgAdmin = user.orgRole === 'org:admin' && acceptance.staff.organizationId === user.organizationId

  if (!isOwner && !isOrgAdmin) {
    return c.json({ error: 'FORBIDDEN', message: 'Not authorized to download this PDF' }, 403)
  }

  const url = await getSignedDownloadUrl(acceptance.pdfR2Key, 3600)
  if (!url) {
    return c.json({ error: 'STORAGE_ERROR', message: 'Failed to generate download URL' }, 500)
  }

  return c.json({ url })
})

export { termsRoute }
