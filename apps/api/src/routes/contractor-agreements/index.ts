/**
 * Contractor agreement API routes
 * Staff acceptance flow with PDF storage and version tracking.
 */
import { randomUUID } from 'node:crypto'
import { Hono, type Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { zValidator } from '@hono/zod-validator'
import { Prisma } from '@ella/db'
import { CURRENT_CONTRACTOR_AGREEMENT_VERSION } from '@ella/shared'
import { prisma } from '../../lib/db'
import { requireOrg } from '../../middleware/auth'
import {
  uploadFile,
  getSignedDownloadUrl,
  deleteFile,
  fetchImageBuffer,
} from '../../services/storage'
import type { AuthVariables } from '../../middleware/auth'
import {
  CONTRACTOR_AGREEMENT_FIRM_SIGNER,
  CONTRACTOR_AGREEMENT_SIGNED_PDF_PREFIX,
  CURRENT_CONTRACTOR_AGREEMENT_TEMPLATE,
} from '../../services/contractor-agreements/contractor-agreement-config'
import {
  generateContractorAgreementPdf,
  sha256Hex,
} from '../../services/contractor-agreements/contractor-agreement-pdf'
import {
  acceptContractorAgreementSchema,
  acceptanceParamsSchema,
  downloadParamsSchema,
} from './schemas'

const contractorAgreementsRoute = new Hono<{ Variables: AuthVariables }>()

contractorAgreementsRoute.use('*', requireOrg)

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
  firmSignerName: string
  firmSignerEmail: string
  firmSignerTitle: string | null
}) {
  return {
    id: acceptance.id,
    version: acceptance.version,
    signedAt: acceptance.signedAt.toISOString(),
    signerName: acceptance.signerName,
    signerEmail: acceptance.signerEmail,
    firmSignerName: acceptance.firmSignerName,
    firmSignerEmail: acceptance.firmSignerEmail,
    firmSignerTitle: acceptance.firmSignerTitle,
  }
}

function serializeOrganization(
  organization?: {
    name: string
    address: string | null
    city: string | null
    state: string | null
    zip: string | null
    governingState: string | null
    governingCounty: string | null
    firmPhone: string | null
    firmEmail: string | null
    firmWebsite: string | null
  } | null
) {
  return {
    name: organization?.name ?? '',
    address: organization?.address ?? null,
    city: organization?.city ?? null,
    state: organization?.state ?? null,
    zip: organization?.zip ?? null,
    governingState: organization?.governingState ?? null,
    governingCounty: organization?.governingCounty ?? null,
    firmPhone: organization?.firmPhone ?? null,
    firmEmail: organization?.firmEmail ?? null,
    firmWebsite: organization?.firmWebsite ?? null,
  }
}

function getOrganizationId(user: AuthVariables['user']): string {
  if (!user.organizationId) {
    throw new Error('Organization context missing after requireOrg')
  }
  return user.organizationId
}

async function getFirmSignerSnapshot(organizationId: string) {
  const configuredSigner = await prisma.staff.findFirst({
    where: {
      organizationId,
      isActive: true,
      email: CONTRACTOR_AGREEMENT_FIRM_SIGNER.email,
      signaturePngKey: { not: null },
    },
    select: {
      name: true,
      email: true,
      title: true,
      signaturePngKey: true,
    },
  })

  const firmSigner =
    configuredSigner ??
    (await prisma.staff.findFirst({
      where: {
        organizationId,
        role: 'ADMIN',
        isActive: true,
        signaturePngKey: { not: null },
      },
      select: {
        name: true,
        email: true,
        title: true,
        signaturePngKey: true,
      },
      orderBy: { createdAt: 'asc' },
    }))

  if (!firmSigner?.signaturePngKey) {
    return null
  }

  return {
    name: firmSigner.name,
    email: firmSigner.email,
    title: firmSigner.title,
    signaturePngKey: firmSigner.signaturePngKey,
  }
}

// GET /contractor-agreements/status - Check whether contractor agreement is required/current
contractorAgreementsRoute.get('/status', async (c) => {
  const user = c.get('user')
  if (!user.staffId) {
    return c.json({ error: 'Staff record not found' }, 404)
  }
  const organizationId = getOrganizationId(user)

  const staff = await prisma.staff.findFirst({
    where: { id: user.staffId, organizationId, isActive: true },
    select: {
      isContractorAgent: true,
      organization: {
        select: {
          name: true,
          address: true,
          city: true,
          state: true,
          zip: true,
          governingState: true,
          governingCounty: true,
          firmPhone: true,
          firmEmail: true,
          firmWebsite: true,
        },
      },
    },
  })

  if (!staff) {
    return c.json({ error: 'Staff record not found' }, 404)
  }

  const acceptance = await prisma.contractorAgreementAcceptance.findUnique({
    where: {
      staffId_version: {
        staffId: user.staffId,
        version: CURRENT_CONTRACTOR_AGREEMENT_VERSION,
      },
    },
    select: { id: true, signedAt: true, version: true },
  })
  const firmSigner = staff.isContractorAgent ? await getFirmSignerSnapshot(organizationId) : null
  const firmSignatureUrl = firmSigner?.signaturePngKey
    ? await getSignedDownloadUrl(firmSigner.signaturePngKey, 3600)
    : null

  return c.json({
    required: staff.isContractorAgent,
    hasAccepted: !!acceptance,
    currentVersion: CURRENT_CONTRACTOR_AGREEMENT_VERSION,
    acceptedVersion: acceptance?.version,
    acceptedAt: acceptance?.signedAt.toISOString(),
    acceptanceId: acceptance?.id,
    organization: serializeOrganization(staff.organization),
    firmSigner: firmSigner
      ? {
          name: firmSigner.name,
          email: firmSigner.email,
          title: firmSigner.title ?? CONTRACTOR_AGREEMENT_FIRM_SIGNER.fallbackTitle,
          signatureUrl: firmSignatureUrl,
        }
      : null,
  })
})

// POST /contractor-agreements/accept - Submit contractor agreement acceptance with signed PDF
contractorAgreementsRoute.post(
  '/accept',
  bodyLimit({ maxSize: 15 * 1024 * 1024 }),
  zValidator('json', acceptContractorAgreementSchema),
  async (c) => {
    const user = c.get('user')
    if (!user.staffId) {
      return c.json({ error: 'Staff record not found' }, 404)
    }
    const organizationId = getOrganizationId(user)

    const body = c.req.valid('json')
    if (body.version !== CURRENT_CONTRACTOR_AGREEMENT_VERSION) {
      return c.json(
        { error: 'VERSION_MISMATCH', message: 'Contractor agreement version outdated' },
        400
      )
    }

    const staff = await prisma.staff.findFirst({
      where: { id: user.staffId, organizationId: user.organizationId, isActive: true },
      select: { id: true, name: true, email: true, isContractorAgent: true },
    })

    if (!staff) {
      return c.json({ error: 'Staff record not found' }, 404)
    }
    if (!staff.isContractorAgent) {
      return c.json(
        {
          error: 'NOT_REQUIRED',
          message: 'Contractor agreement is not required for this staff member',
        },
        409
      )
    }

    const existingAcceptance = await prisma.contractorAgreementAcceptance.findUnique({
      where: {
        staffId_version: {
          staffId: user.staffId,
          version: body.version,
        },
      },
      select: {
        id: true,
        version: true,
        signedAt: true,
        signerName: true,
        signerEmail: true,
        firmSignerName: true,
        firmSignerEmail: true,
        firmSignerTitle: true,
      },
    })
    if (existingAcceptance) {
      return c.json(serializeAcceptance(existingAcceptance), 200)
    }

    const r2Key = `${CONTRACTOR_AGREEMENT_SIGNED_PDF_PREFIX}/${organizationId}/${user.staffId}/${body.version}/${randomUUID()}.pdf`
    const ipAddress = extractIp(c)
    const userAgent = c.req.header('user-agent') || null
    const firmSigner = await getFirmSignerSnapshot(organizationId)
    if (!firmSigner) {
      return c.json(
        {
          error: 'FIRM_SIGNER_NOT_CONFIGURED',
          message: 'Firm signer signature is not configured',
        },
        422
      )
    }
    const firmSignature = await fetchImageBuffer(firmSigner.signaturePngKey)
    if (!firmSignature?.buffer) {
      return c.json(
        {
          error: 'FIRM_SIGNER_SIGNATURE_UNAVAILABLE',
          message: 'Firm signer signature could not be loaded',
        },
        422
      )
    }

    const signedAt = new Date()
    let pdfBuffer: Buffer
    try {
      pdfBuffer = await generateContractorAgreementPdf({
        contractor: {
          name: staff.name,
          email: staff.email,
          signaturePngDataUrl: body.signaturePngDataUrl,
        },
        firmSigner: {
          name: firmSigner.name,
          email: firmSigner.email,
          title: firmSigner.title ?? CONTRACTOR_AGREEMENT_FIRM_SIGNER.fallbackTitle,
          signaturePngBuffer: firmSignature.buffer,
        },
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
          500
        )
      }
    } catch (error) {
      console.error('[ContractorAgreement] PDF upload failed:', error)
      return c.json({ error: 'UPLOAD_FAILED', message: 'Failed to store signed PDF' }, 500)
    }

    let acceptance
    try {
      acceptance = await prisma.contractorAgreementAcceptance.create({
        data: {
          staffId: user.staffId,
          organizationId,
          version: body.version,
          signedPdfR2Key: r2Key,
          sourceTemplateR2Key: CURRENT_CONTRACTOR_AGREEMENT_TEMPLATE.sourceKey,
          pdfSha256,
          signerName: staff.name,
          signerEmail: staff.email,
          signerIpAddress: ipAddress,
          signerUserAgent: userAgent,
          firmSignerName: firmSigner.name,
          firmSignerEmail: firmSigner.email,
          firmSignerTitle: firmSigner.title,
          firmSignaturePngKey: firmSigner.signaturePngKey,
          signedAt,
        },
        select: {
          id: true,
          version: true,
          signedAt: true,
          signerName: true,
          signerEmail: true,
          firmSignerName: true,
          firmSignerEmail: true,
          firmSignerTitle: true,
        },
      })
    } catch (error) {
      await deleteFile(r2Key).catch(() => false)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await prisma.contractorAgreementAcceptance.findUnique({
          where: {
            staffId_version: {
              staffId: user.staffId,
              version: body.version,
            },
          },
          select: {
            id: true,
            version: true,
            signedAt: true,
            signerName: true,
            signerEmail: true,
            firmSignerName: true,
            firmSignerEmail: true,
            firmSignerTitle: true,
          },
        })
        if (existing) {
          return c.json(serializeAcceptance(existing), 200)
        }
        return c.json({ error: 'ALREADY_ACCEPTED', message: 'Already accepted this version' }, 409)
      }
      throw error
    }

    return c.json(serializeAcceptance(acceptance), 201)
  }
)

// GET /contractor-agreements/acceptance/:staffId - Get staff's current contractor agreement acceptance
contractorAgreementsRoute.get(
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
      if (user.orgRole !== 'org:admin' && user.role !== 'ADMIN') {
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

    const acceptance = await prisma.contractorAgreementAcceptance.findFirst({
      where: { staffId, organizationId, version: CURRENT_CONTRACTOR_AGREEMENT_VERSION },
      orderBy: { signedAt: 'desc' },
      select: {
        id: true,
        version: true,
        signedAt: true,
        signerName: true,
        signerEmail: true,
        firmSignerName: true,
        firmSignerEmail: true,
        firmSignerTitle: true,
      },
    })

    if (!acceptance) {
      return c.json(
        { error: 'NOT_ACCEPTED', message: 'No contractor agreement acceptance found' },
        404
      )
    }

    return c.json(serializeAcceptance(acceptance))
  }
)

// GET /contractor-agreements/download/:acceptanceId - Download signed PDF
contractorAgreementsRoute.get(
  '/download/:acceptanceId',
  zValidator('param', downloadParamsSchema),
  async (c) => {
    const user = c.get('user')
    if (!user.staffId) {
      return c.json({ error: 'Staff record not found' }, 404)
    }

    const { acceptanceId } = c.req.valid('param')
    const acceptance = await prisma.contractorAgreementAcceptance.findUnique({
      where: { id: acceptanceId },
      select: { id: true, staffId: true, organizationId: true, signedPdfR2Key: true },
    })

    if (!acceptance || acceptance.organizationId !== user.organizationId) {
      return c.json({ error: 'NOT_FOUND', message: 'Acceptance record not found' }, 404)
    }

    const isOwner = acceptance.staffId === user.staffId
    const isOrgAdmin = user.orgRole === 'org:admin' || user.role === 'ADMIN'
    if (!isOwner && !isOrgAdmin) {
      return c.json({ error: 'FORBIDDEN', message: 'Not authorized to download this PDF' }, 403)
    }

    const url = await getSignedDownloadUrl(acceptance.signedPdfR2Key, 3600)
    if (!url) {
      return c.json({ error: 'STORAGE_ERROR', message: 'Failed to generate download URL' }, 500)
    }

    return c.json({ url })
  }
)

export { contractorAgreementsRoute }
