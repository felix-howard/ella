/**
 * Terms & Conditions API routes
 * Staff acceptance flow with PDF storage and version tracking
 */
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { zValidator } from '@hono/zod-validator'
import { Prisma } from '@ella/db'
import { prisma } from '../../lib/db'
import { uploadFile, getSignedDownloadUrl } from '../../services/storage'
import { CURRENT_TERMS_VERSION } from '@ella/shared'
import type { AuthVariables } from '../../middleware/auth'
import { acceptTermsSchema, downloadParamsSchema, acceptanceParamsSchema } from './schemas'

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
termsRoute.post('/accept', bodyLimit({ maxSize: 15 * 1024 * 1024 }), zValidator('json', acceptTermsSchema), async (c) => {
  const user = c.get('user')
  if (!user.staffId) {
    return c.json({ error: 'Staff record not found' }, 404)
  }

  const { version, pdfBase64 } = c.req.valid('json')

  if (version !== CURRENT_TERMS_VERSION) {
    return c.json({ error: 'VERSION_MISMATCH', message: 'Terms version outdated' }, 400)
  }

  const pdfBuffer = Buffer.from(pdfBase64, 'base64')
  const r2Key = `terms/${user.organizationId}/${user.staffId}/${version}.pdf`

  // Capture IP and user agent server-side
  const ipAddress = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    || c.req.header('x-real-ip')
    || 'unknown'
  const userAgent = c.req.header('user-agent') || null

  // DB insert first to catch P2002 duplicate before uploading to R2 (avoids orphan files)
  let acceptance
  try {
    acceptance = await prisma.termsAcceptance.create({
      data: {
        staffId: user.staffId,
        version,
        pdfR2Key: r2Key,
        ipAddress,
        userAgent,
      },
      select: { id: true, version: true, signedAt: true },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return c.json({ error: 'ALREADY_ACCEPTED', message: 'Already accepted this version' }, 409)
    }
    throw error
  }

  try {
    await uploadFile(r2Key, pdfBuffer, 'application/pdf')
  } catch (error) {
    console.error('[Terms] PDF upload failed, cleaning up DB record:', error)
    await prisma.termsAcceptance.delete({ where: { id: acceptance.id } }).catch(() => {})
    return c.json({ error: 'UPLOAD_FAILED', message: 'Failed to store signed PDF' }, 500)
  }

  return c.json({
    id: acceptance.id,
    version: acceptance.version,
    signedAt: acceptance.signedAt.toISOString(),
  }, 201)
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

// GET /terms/acceptance/:staffId - Get staff's latest acceptance record
termsRoute.get('/acceptance/:staffId', zValidator('param', acceptanceParamsSchema), async (c) => {
  const user = c.get('user')
  const { staffId: rawStaffId } = c.req.valid('param')

  // Resolve 'me' to current user's staffId
  const staffId = rawStaffId === 'me' ? user.staffId : rawStaffId

  if (!staffId) {
    return c.json({ error: 'Staff record not found' }, 404)
  }

  // Authorization: own record or admin in same org
  if (staffId !== user.staffId) {
    if (user.orgRole !== 'org:admin') {
      return c.json({ error: 'FORBIDDEN', message: 'Not authorized' }, 403)
    }

    const targetStaff = await prisma.staff.findUnique({
      where: { id: staffId },
      select: { organizationId: true },
    })

    if (!targetStaff || targetStaff.organizationId !== user.organizationId) {
      return c.json({ error: 'NOT_FOUND', message: 'Staff not found' }, 404)
    }
  }

  const acceptance = await prisma.termsAcceptance.findFirst({
    where: { staffId },
    orderBy: { signedAt: 'desc' },
    select: { id: true, version: true, signedAt: true },
  })

  if (!acceptance) {
    return c.json({ error: 'NOT_ACCEPTED', message: 'No terms acceptance found' }, 404)
  }

  return c.json({
    id: acceptance.id,
    version: acceptance.version,
    signedAt: acceptance.signedAt.toISOString(),
  })
})

export { termsRoute }
