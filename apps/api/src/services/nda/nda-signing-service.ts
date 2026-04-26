/**
 * Public NDA signing flow.
 *
 * Order of operations is tuned for concurrent-sign safety:
 *   1. Load NDA + guard status/expiry
 *   2. Decode signature PNG
 *   3. Upload PNG + PDF to R2 under NONCED keys (unique per attempt)
 *   4. Transactional DB update guarded by `WHERE status='SENT' AND isActive=true`
 *   5. If count==0 -> 409 (the other signer won the race, orphaned R2 objects
 *      stay at their nonced keys and are harmless — they'll be swept by R2
 *      lifecycle rules eventually; the canonical keys referenced by the DB
 *      row always belong to the winning attempt)
 */
import { customAlphabet } from 'nanoid'
import { HTTPException } from 'hono/http-exception'
import type { Prisma } from '@ella/db'
import { prisma } from '../../lib/db'
import { uploadFile, getSignedDownloadUrl } from '../storage'
import { isExpired } from './token-service'
import { decodeSignaturePng } from '../../routes/nda/helpers'
import { generateSignedPdf } from './pdf-generator'
import { getTemplate } from '../../lib/nda/template-registry'
import type { TemplateSection } from '../../lib/nda/types'

const DOWNLOAD_TTL_SECONDS = 900 // 15 min
const generateAttemptNonce = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10)

export type LoadedNda = Prisma.NdaAgreementGetPayload<{
  include: {
    lead: { select: { id: true; firstName: true; lastName: true } }
    organization: { select: { id: true; name: true } }
  }
}>

export async function loadNdaByToken(token: string): Promise<LoadedNda | null> {
  return prisma.ndaAgreement.findUnique({
    where: { token },
    include: {
      lead: { select: { id: true, firstName: true, lastName: true } },
      organization: { select: { id: true, name: true } },
    },
  })
}

export interface PublicNdaView {
  status: string
  expiresAt: Date | null
  expired: boolean
  templateVersion: string
  templateTitle: string
  templateSections: TemplateSection[]
  templateHtml: string | null
  depositAmount: string
  orgName: string
  leadFirstName: string
}

export function toPublicView(nda: LoadedNda): PublicNdaView {
  const template = getTemplate(nda.templateVersion)
  const depositAmount = `$${nda.depositAmount.toString()}`
  const leadFullName = [nda.lead.firstName, nda.lead.lastName].filter(Boolean).join(' ')
  const sections = template.render({
    leadFullName,
    orgName: nda.organization.name,
    depositAmount,
    date: nda.createdAt.toISOString().slice(0, 10),
    templateVersion: nda.templateVersion,
  })
  return {
    status: nda.status,
    expiresAt: nda.expiresAt,
    expired: isExpired(nda.expiresAt),
    templateVersion: nda.templateVersion,
    templateTitle: template.title,
    templateSections: sections,
    // Sanitized at write time (sanitizeNdaHtml). Legacy templateSections kept
    // for back-compat with portal builds that don't yet read templateHtml.
    // `|| null` (not `??`) so empty strings collapse to null and the portal
    // takes the legacy render branch instead of an empty custom HTML block.
    templateHtml: nda.customContentHtml || null,
    depositAmount,
    orgName: nda.organization.name,
    leadFirstName: nda.lead.firstName,
  }
}

export async function signNda(input: {
  token: string
  signerName: string
  signaturePngDataUrl: string
  ip: string
  userAgent: string
}) {
  const nda = await loadNdaByToken(input.token)
  if (!nda) throw new HTTPException(404, { message: 'NDA link not found' })

  if (nda.status !== 'SENT' || !nda.isActive) {
    throw new HTTPException(409, { message: 'NDA is not available for signing' })
  }
  if (isExpired(nda.expiresAt)) {
    throw new HTTPException(410, { message: 'NDA link has expired' })
  }

  const decoded = decodeSignaturePng(input.signaturePngDataUrl)
  const signedAt = new Date()

  // Nonced keys so concurrent sign attempts don't clobber each other's R2 objects.
  // Only the winning attempt's keys get written to the DB row.
  const nonce = generateAttemptNonce()
  const signaturePngKey = `leads/${nda.leadId}/nda/${nda.id}-${nonce}-signature.png`
  const signedPdfKey = `leads/${nda.leadId}/nda/${nda.id}-${nonce}-signed.pdf`

  await uploadFile(signaturePngKey, decoded.buffer, 'image/png')

  const pdfBuffer = await generateSignedPdf({
    ndaAgreement: {
      templateVersion: nda.templateVersion,
      depositAmount: nda.depositAmount,
      customContentHtml: nda.customContentHtml,
    },
    lead: { firstName: nda.lead.firstName, lastName: nda.lead.lastName },
    organization: { name: nda.organization.name },
    signature: {
      pngBuffer: decoded.buffer,
      typedName: input.signerName,
      ipAddress: input.ip,
      userAgent: input.userAgent,
      signedAt,
    },
  })

  await uploadFile(signedPdfKey, pdfBuffer, 'application/pdf')

  const result = await prisma.ndaAgreement.updateMany({
    where: { id: nda.id, status: 'SENT', isActive: true },
    data: {
      status: 'SIGNED',
      signedAt,
      signerName: input.signerName,
      signerIpAddress: input.ip,
      signerUserAgent: input.userAgent,
      signaturePngKey,
      signedPdfKey,
      isActive: false,
      lastUsedAt: signedAt,
      usageCount: { increment: 1 },
    },
  })

  if (result.count === 0) {
    throw new HTTPException(409, { message: 'NDA was already signed' })
  }

  const downloadUrl = await getSignedDownloadUrl(signedPdfKey, DOWNLOAD_TTL_SECONDS)
  return {
    status: 'SIGNED' as const,
    signedAt,
    downloadUrl,
  }
}
