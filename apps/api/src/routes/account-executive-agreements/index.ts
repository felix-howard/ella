/**
 * Account Executive agreement API routes.
 * Staff with the MANAGER role must sign; member-only signature, PDF stored in R2.
 */
import { randomUUID } from 'node:crypto'
import { Hono, type Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { zValidator } from '@hono/zod-validator'
import { Prisma } from '@ella/db'
import { CURRENT_ACCOUNT_EXECUTIVE_AGREEMENT_VERSION } from '@ella/shared'
import { prisma } from '../../lib/db'
import { isAdminOrManager } from '../../lib/org-scope'
import { requireOrg } from '../../middleware/auth'
import { uploadFile, getSignedDownloadUrl, deleteFile } from '../../services/storage'
import type { AuthVariables } from '../../middleware/auth'
import { ACCOUNT_EXECUTIVE_AGREEMENT_SIGNED_PDF_PREFIX } from '../../services/account-executive-agreements/account-executive-agreement-config'
import {
  generateAccountExecutiveAgreementPdf,
  sha256Hex,
} from '../../services/account-executive-agreements/account-executive-agreement-pdf'
import {
  acceptAccountExecutiveAgreementSchema,
  acceptanceParamsSchema,
  downloadParamsSchema,
} from './schemas'

const accountExecutiveAgreementsRoute = new Hono<{ Variables: AuthVariables }>()

accountExecutiveAgreementsRoute.use('*', requireOrg)

function extractIp(c: Context): string {
  return (
    c.req.header('cf-connecting-ip')?.trim() ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip')?.trim() ||
    'unknown'
  )
}

function serializeAcceptance(acceptance: {
  id: string
  version: string
  signedAt: Date
  signerName: string
  signerEmail: string
}) {
  return {
    id: acceptance.id,
    version: acceptance.version,
    signedAt: acceptance.signedAt.toISOString(),
    signerName: acceptance.signerName,
    signerEmail: acceptance.signerEmail,
  }
}

function getOrganizationId(user: AuthVariables['user']): string {
  if (!user.organizationId) {
    throw new Error('Organization context missing after requireOrg')
  }
  return user.organizationId
}

const ACCEPTANCE_SELECT = {
  id: true,
  version: true,
  signedAt: true,
  signerName: true,
  signerEmail: true,
} as const

// GET /account-executive-agreements/status - Whether the agreement is required/current for the caller
accountExecutiveAgreementsRoute.get('/status', async (c) => {
  const user = c.get('user')
  if (!user.staffId) {
    return c.json({ error: 'Staff record not found' }, 404)
  }
  const organizationId = getOrganizationId(user)

  const staff = await prisma.staff.findFirst({
    where: { id: user.staffId, organizationId, isActive: true },
    select: {
      name: true,
      role: true,
      organization: { select: { name: true } },
    },
  })

  if (!staff) {
    return c.json({ error: 'Staff record not found' }, 404)
  }

  const required = staff.role === 'MANAGER'

  const acceptance = await prisma.accountExecutiveAgreementAcceptance.findUnique({
    where: {
      staffId_version: {
        staffId: user.staffId,
        version: CURRENT_ACCOUNT_EXECUTIVE_AGREEMENT_VERSION,
      },
    },
    select: { id: true, signedAt: true, version: true },
  })

  return c.json({
    required,
    hasAccepted: !!acceptance,
    currentVersion: CURRENT_ACCOUNT_EXECUTIVE_AGREEMENT_VERSION,
    acceptedVersion: acceptance?.version,
    acceptedAt: acceptance?.signedAt.toISOString(),
    acceptanceId: acceptance?.id,
    organizationName: staff.organization?.name ?? '',
    signerName: staff.name,
  })
})

// POST /account-executive-agreements/accept - Submit acceptance with signed PDF
accountExecutiveAgreementsRoute.post(
  '/accept',
  bodyLimit({ maxSize: 15 * 1024 * 1024 }),
  zValidator('json', acceptAccountExecutiveAgreementSchema),
  async (c) => {
    const user = c.get('user')
    if (!user.staffId) {
      return c.json({ error: 'Staff record not found' }, 404)
    }
    const organizationId = getOrganizationId(user)

    const body = c.req.valid('json')
    if (body.version !== CURRENT_ACCOUNT_EXECUTIVE_AGREEMENT_VERSION) {
      return c.json(
        { error: 'VERSION_MISMATCH', message: 'Account executive agreement version outdated' },
        400,
      )
    }

    const staff = await prisma.staff.findFirst({
      where: { id: user.staffId, organizationId, isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organization: { select: { name: true } },
      },
    })

    if (!staff) {
      return c.json({ error: 'Staff record not found' }, 404)
    }
    if (staff.role !== 'MANAGER') {
      return c.json(
        {
          error: 'NOT_REQUIRED',
          message: 'Account executive agreement is not required for this staff member',
        },
        409,
      )
    }

    const existingAcceptance = await prisma.accountExecutiveAgreementAcceptance.findUnique({
      where: { staffId_version: { staffId: user.staffId, version: body.version } },
      select: ACCEPTANCE_SELECT,
    })
    if (existingAcceptance) {
      return c.json(serializeAcceptance(existingAcceptance), 200)
    }

    const r2Key = `${ACCOUNT_EXECUTIVE_AGREEMENT_SIGNED_PDF_PREFIX}/${organizationId}/${user.staffId}/${body.version}/${randomUUID()}.pdf`
    const ipAddress = extractIp(c)
    const userAgent = c.req.header('user-agent') || null
    const signedAt = new Date()

    let pdfBuffer: Buffer
    try {
      pdfBuffer = await generateAccountExecutiveAgreementPdf({
        companyName: staff.organization?.name ?? '',
        signerName: staff.name,
        signerEmail: staff.email,
        signaturePngDataUrl: body.signaturePngDataUrl,
        signedAt,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid signature payload'
      return c.json({ error: 'PDF_GENERATION_FAILED', message }, 400)
    }

    const pdfSha256 = sha256Hex(pdfBuffer)

    try {
      const uploaded = await uploadFile(r2Key, pdfBuffer, 'application/pdf')
      if (!uploaded.url) {
        await deleteFile(r2Key).catch(() => false)
        return c.json(
          { error: 'STORAGE_NOT_CONFIGURED', message: 'Signed PDF storage is not configured' },
          500,
        )
      }
    } catch (error) {
      console.error('[AccountExecutiveAgreement] PDF upload failed:', error)
      return c.json({ error: 'UPLOAD_FAILED', message: 'Failed to store signed PDF' }, 500)
    }

    let acceptance
    try {
      acceptance = await prisma.accountExecutiveAgreementAcceptance.create({
        data: {
          staffId: user.staffId,
          organizationId,
          version: body.version,
          signedPdfR2Key: r2Key,
          pdfSha256,
          signerName: staff.name,
          signerEmail: staff.email,
          signerIpAddress: ipAddress,
          signerUserAgent: userAgent,
          signedAt,
        },
        select: ACCEPTANCE_SELECT,
      })
    } catch (error) {
      await deleteFile(r2Key).catch(() => false)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await prisma.accountExecutiveAgreementAcceptance.findUnique({
          where: { staffId_version: { staffId: user.staffId, version: body.version } },
          select: ACCEPTANCE_SELECT,
        })
        if (existing) {
          return c.json(serializeAcceptance(existing), 200)
        }
        return c.json({ error: 'ALREADY_ACCEPTED', message: 'Already accepted this version' }, 409)
      }
      throw error
    }

    return c.json(serializeAcceptance(acceptance), 201)
  },
)

// GET /account-executive-agreements/acceptance/:staffId - Latest acceptance for a staff member
accountExecutiveAgreementsRoute.get(
  '/acceptance/:staffId',
  zValidator('param', acceptanceParamsSchema),
  async (c) => {
    const user = c.get('user')
    const { staffId: rawStaffId } = c.req.valid('param')
    const staffId = rawStaffId === 'me' ? user.staffId : rawStaffId
    const organizationId = getOrganizationId(user)

    if (!staffId) {
      return c.json({ error: 'Staff record not found' }, 404)
    }

    if (staffId !== user.staffId) {
      if (!isAdminOrManager(user)) {
        return c.json({ error: 'FORBIDDEN', message: 'Not authorized' }, 403)
      }

      const targetStaff = await prisma.staff.findUnique({
        where: { id: staffId },
        select: { organizationId: true },
      })

      if (!targetStaff || targetStaff.organizationId !== organizationId) {
        return c.json({ error: 'NOT_FOUND', message: 'Staff not found' }, 404)
      }
    }

    const acceptance = await prisma.accountExecutiveAgreementAcceptance.findFirst({
      where: { staffId, organizationId, version: CURRENT_ACCOUNT_EXECUTIVE_AGREEMENT_VERSION },
      orderBy: { signedAt: 'desc' },
      select: ACCEPTANCE_SELECT,
    })

    if (!acceptance) {
      return c.json(
        { error: 'NOT_ACCEPTED', message: 'No account executive agreement acceptance found' },
        404,
      )
    }

    return c.json(serializeAcceptance(acceptance))
  },
)

// GET /account-executive-agreements/download/:acceptanceId - Signed PDF download URL
accountExecutiveAgreementsRoute.get(
  '/download/:acceptanceId',
  zValidator('param', downloadParamsSchema),
  async (c) => {
    const user = c.get('user')
    if (!user.staffId) {
      return c.json({ error: 'Staff record not found' }, 404)
    }

    const { acceptanceId } = c.req.valid('param')
    const acceptance = await prisma.accountExecutiveAgreementAcceptance.findUnique({
      where: { id: acceptanceId },
      select: { id: true, staffId: true, organizationId: true, signedPdfR2Key: true },
    })

    if (!acceptance || acceptance.organizationId !== user.organizationId) {
      return c.json({ error: 'NOT_FOUND', message: 'Acceptance record not found' }, 404)
    }

    const isOwner = acceptance.staffId === user.staffId
    if (!isOwner && !isAdminOrManager(user)) {
      return c.json({ error: 'FORBIDDEN', message: 'Not authorized to download this PDF' }, 403)
    }

    const url = await getSignedDownloadUrl(acceptance.signedPdfR2Key, 3600)
    if (!url) {
      return c.json({ error: 'STORAGE_ERROR', message: 'Failed to generate download URL' }, 500)
    }

    return c.json({ url })
  },
)

export { accountExecutiveAgreementsRoute }
