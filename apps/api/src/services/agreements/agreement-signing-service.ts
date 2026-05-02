/**
 * Public agreement signing flow.
 *
 * Order of operations is tuned for concurrent-sign safety:
 *   1. Load agreement + guard status/expiry
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
import { decodeSignaturePng } from '../../routes/agreements/helpers'
import { generateSignedPdf } from './pdf-generator'
import { getTemplate } from '../../lib/agreements/template-registry'
import type { TemplateSection } from '../../lib/agreements/types'

const DOWNLOAD_TTL_SECONDS = 900 // 15 min
const generateAttemptNonce = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10)

type RawLoadedAgreement = Prisma.AgreementGetPayload<{
  include: {
    lead: { select: { id: true; firstName: true; lastName: true } }
    client: { select: { id: true; firstName: true; lastName: true } }
    organization: { select: { id: true; name: true } }
  }
}>

// Agreement can be scoped to either a Lead (pre-conversion) or a Client
// (created directly from the Agreements tab). Both relations are nullable +
// SetNull on the schema, so the public flow normalizes whichever is present
// into `signer` and rejects the rare case where both are detached.
export type SignerKind = 'lead' | 'client'
export type LoadedAgreement = RawLoadedAgreement & {
  signer: {
    id: string
    firstName: string
    lastName: string | null
    kind: SignerKind
  }
}

/** Legacy alias retained for transitional callers. */
export type LoadedNda = LoadedAgreement

export async function loadAgreementByToken(token: string): Promise<LoadedAgreement | null> {
  const agreement = await prisma.agreement.findUnique({
    where: { token },
    include: {
      lead: { select: { id: true, firstName: true, lastName: true } },
      client: { select: { id: true, firstName: true, lastName: true } },
      organization: { select: { id: true, name: true } },
    },
  })
  if (!agreement) return null

  // Prefer lead when both exist (lead-originated agreements may carry a
  // clientId after conversion). Fall back to client for direct-created.
  if (agreement.lead && agreement.leadId) {
    return {
      ...agreement,
      signer: {
        id: agreement.lead.id,
        firstName: agreement.lead.firstName,
        lastName: agreement.lead.lastName,
        kind: 'lead',
      },
    }
  }
  if (agreement.client && agreement.clientId) {
    return {
      ...agreement,
      signer: {
        id: agreement.client.id,
        firstName: agreement.client.firstName,
        lastName: agreement.client.lastName,
        kind: 'client',
      },
    }
  }
  // Both originating entities deleted — treat as link not found.
  return null
}

/** Legacy alias retained for transitional callers. */
export const loadNdaByToken = loadAgreementByToken

export interface PublicAgreementView {
  status: string
  expiresAt: Date | null
  expired: boolean
  templateVersion: string
  templateTitle: string
  templateSections: TemplateSection[]
  templateHtml: string | null
  /** Formatted deposit amount (`$300.00`) when a deposit applies; null otherwise. */
  depositAmount: string | null
  orgName: string
  leadFirstName: string
}

/** Legacy alias retained for transitional callers. */
export type PublicNdaView = PublicAgreementView

export function toPublicView(agreement: LoadedAgreement): PublicAgreementView {
  const template = getTemplate(agreement.templateVersion)
  const depositAmount = agreement.depositAmount
    ? `$${agreement.depositAmount.toString()}`
    : null
  const fullName = [agreement.signer.firstName, agreement.signer.lastName]
    .filter(Boolean)
    .join(' ')
  const sections = template.render({
    leadFullName: fullName,
    orgName: agreement.organization.name,
    depositAmount: depositAmount ?? '',
    date: agreement.createdAt.toISOString().slice(0, 10),
    templateVersion: agreement.templateVersion,
  })
  return {
    status: agreement.status,
    expiresAt: agreement.expiresAt,
    expired: isExpired(agreement.expiresAt),
    templateVersion: agreement.templateVersion,
    templateTitle: agreement.title || template.title,
    templateSections: sections,
    // Sanitized at write time. Legacy templateSections kept for back-compat
    // with portal builds that don't yet read templateHtml. `|| null` (not
    // `??`) so empty strings collapse to null and the portal takes the legacy
    // render branch instead of an empty custom HTML block.
    templateHtml: agreement.customContentHtml || null,
    depositAmount,
    orgName: agreement.organization.name,
    leadFirstName: agreement.signer.firstName,
  }
}

export async function signAgreement(input: {
  token: string
  signerName: string
  signaturePngDataUrl: string
  ip: string
  userAgent: string
}) {
  const agreement = await loadAgreementByToken(input.token)
  if (!agreement) throw new HTTPException(404, { message: 'Agreement link not found' })

  if (agreement.status !== 'SENT' || !agreement.isActive) {
    throw new HTTPException(409, { message: 'Agreement is not available for signing' })
  }
  if (isExpired(agreement.expiresAt)) {
    throw new HTTPException(410, { message: 'Agreement link has expired' })
  }

  const decoded = decodeSignaturePng(input.signaturePngDataUrl)
  const signedAt = new Date()

  // Nonced keys so concurrent sign attempts don't clobber each other's R2
  // objects. Only the winning attempt's keys get written to the DB row. Path
  // prefix mirrors the originating entity so client-direct agreements land
  // under clients/.
  const nonce = generateAttemptNonce()
  // R2 key prefix retains `/nda/` directory for storage continuity with the
  // pre-rename history. Functionally inert — only the column on the row
  // determines what we sign back.
  const keyPrefix = agreement.signer.kind === 'lead' ? 'leads' : 'clients'
  const signaturePngKey = `${keyPrefix}/${agreement.signer.id}/nda/${agreement.id}-${nonce}-signature.png`
  const signedPdfKey = `${keyPrefix}/${agreement.signer.id}/nda/${agreement.id}-${nonce}-signed.pdf`

  await uploadFile(signaturePngKey, decoded.buffer, 'image/png')

  const pdfBuffer = await generateSignedPdf({
    agreement: {
      templateVersion: agreement.templateVersion,
      depositAmount: agreement.depositAmount ?? '0.00',
      customContentHtml: agreement.customContentHtml,
      title: agreement.title,
    },
    lead: { firstName: agreement.signer.firstName, lastName: agreement.signer.lastName },
    organization: { name: agreement.organization.name },
    signature: {
      pngBuffer: decoded.buffer,
      typedName: input.signerName,
      ipAddress: input.ip,
      userAgent: input.userAgent,
      signedAt,
    },
  })

  await uploadFile(signedPdfKey, pdfBuffer, 'application/pdf')

  const result = await prisma.agreement.updateMany({
    where: { id: agreement.id, status: 'SENT', isActive: true },
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
    throw new HTTPException(409, { message: 'Agreement was already signed' })
  }

  const downloadUrl = await getSignedDownloadUrl(signedPdfKey, DOWNLOAD_TTL_SECONDS)
  return {
    status: 'SIGNED' as const,
    signedAt,
    downloadUrl,
  }
}

/** Legacy alias retained for transitional callers + tests. */
export const signNda = signAgreement
