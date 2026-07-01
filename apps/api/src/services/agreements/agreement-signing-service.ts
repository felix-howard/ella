/**
 * Public agreement signing flow.
 *
 * Order of operations is tuned for concurrent-sign safety:
 *   1. Load agreement + guard status/expiry
 *   2. Decode signature PNG
 *   3. Upload PNG + PDF to R2 under NONCED keys (unique per attempt)
 *   4. Transactional DB update guarded by `WHERE status='SENT' AND isActive=true`
 *   5. If count==0 -> best-effort delete generated artifacts, then 409
 */
import { customAlphabet } from 'nanoid'
import { HTTPException } from 'hono/http-exception'
import type { AgreementStatus, Prisma } from '@ella/db'
import { prisma } from '../../lib/db'
import {
  uploadFile,
  getSignedDownloadUrl,
  fetchImageBuffer,
  fetchFileBuffer,
  deleteFile,
} from '../storage'
import { isExpired } from './token-service'
import { decodeSignaturePng } from '../../routes/agreements/helpers'
import { generateSignedPdf } from './pdf-generator'
import { generateSignaturePagePdf } from './pdf-signature-page'
import { appendPagesToPdf } from './pdf-merge'
import { getTemplate } from '../../lib/agreements/template-registry'
import type { TemplateSection } from '../../lib/agreements/types'
import { getEffectiveFirmPhone } from '../../lib/firm-contact'
import {
  composeAddressLine,
  composeContactLine,
  resolveClientNameOrBusiness,
} from './entity-loader'
import {
  notifyAdminsAgreementSigned,
  type PostSignAgreementContext,
} from './agreement-post-sign-notifications'
import { createDepositPaymentForAgreement } from '../payments/deposit-payment-service'
import {
  activateAgreementQuotePaymentPortal,
  markAgreementQuoteSignedForReview,
  type AgreementQuoteActivationResult,
} from '../payments/agreement-quote-service'

const DOWNLOAD_TTL_SECONDS = 900 // 15 min
const VIEW_PRESIGN_TTL_SECONDS = 900 // 15 min
const generateAttemptNonce = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10)
const PUBLIC_AGREEMENT_TYPE_LABELS: Record<string, string> = {
  NDA: 'NDA',
  ENGAGEMENT_LETTER: 'Engagement Letter',
  SERVICE_AGREEMENT: 'Service Agreement',
  CONSENT_7216: 'Consent Agreement',
  CUSTOM: 'agreement',
}

export type PublicAgreementAccessErrorCode =
  | 'AGREEMENT_VOIDED'
  | 'AGREEMENT_SIGNED'
  | 'AGREEMENT_INACTIVE'

export interface PublicAgreementAccessError {
  error: PublicAgreementAccessErrorCode
  message: string
  documentLabel: string
  status: 409
}

export class AgreementPublicAccessError extends Error {
  readonly code: PublicAgreementAccessErrorCode
  readonly documentLabel: string
  readonly status: 409

  constructor(error: PublicAgreementAccessError) {
    super(error.message)
    this.name = 'AgreementPublicAccessError'
    this.code = error.error
    this.documentLabel = error.documentLabel
    this.status = error.status
  }
}

function getPublicAgreementDocumentLabel(type: string | null | undefined): string {
  return type ? (PUBLIC_AGREEMENT_TYPE_LABELS[type] ?? 'agreement') : 'agreement'
}

export function getPublicAgreementAccessError(input: {
  status: AgreementStatus
  isActive: boolean
  type?: string | null
}): PublicAgreementAccessError | null {
  const documentLabel = getPublicAgreementDocumentLabel(input.type)

  if (input.status === 'VOIDED') {
    return {
      error: 'AGREEMENT_VOIDED',
      message: 'Agreement has been revoked',
      documentLabel,
      status: 409,
    }
  }
  if (input.status === 'SIGNED') {
    return {
      error: 'AGREEMENT_SIGNED',
      message: 'Agreement has already been signed',
      documentLabel,
      status: 409,
    }
  }
  if (input.status !== 'SENT' || !input.isActive) {
    return {
      error: 'AGREEMENT_INACTIVE',
      message: 'Agreement link is not active',
      documentLabel,
      status: 409,
    }
  }
  return null
}

async function deleteGeneratedSigningArtifacts(keys: string[]) {
  await Promise.all(keys.map((key) => deleteFile(key).catch(() => false)))
}

type RawLoadedAgreement = Prisma.AgreementGetPayload<{
  include: {
    lead: {
      select: {
        id: true
        firstName: true
        lastName: true
        businessName: true
      }
    }
    client: {
      select: {
        id: true
        firstName: true
        lastName: true
        clientType: true
        name: true
        businessAddress: true
        businessCity: true
        businessState: true
        businessZip: true
      }
    }
    organization: {
      select: {
        id: true
        name: true
        address: true
        city: true
        state: true
        zip: true
        governingState: true
        governingCounty: true
        firmPhone: true
        firmEmail: true
        firmWebsite: true
      }
    }
  }
}>

function formatHumanDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

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
      lead: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          businessName: true,
        },
      },
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          clientType: true,
          name: true,
          businessAddress: true,
          businessCity: true,
          businessState: true,
          businessZip: true,
        },
      },
      organization: {
        select: {
          id: true,
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

/** v2 snapshot fields exposed to the portal so it can render the
 *  HeaderBlock + Section 21 firm column before the client signs. */
export interface PublicFirmSnapshot {
  name: string
  address: string
  contact: string | null
  signerName: string
  signerTitle: string
  /** Presigned URL (15-min TTL) for the firm's already-drawn signature PNG. */
  signaturePresignedUrl: string | null
  /** Formatted human date (e.g. "May 6, 2026"). */
  signedAt: string | null
}

export interface PublicClientSnapshot {
  nameOrBusiness: string
  address: string
  clientType: 'INDIVIDUAL' | 'BUSINESS'
}

export interface PublicConsentPrefill {
  taxpayerName: string | null
  businessName: string | null
}

export interface PublicAgreementView {
  type: string
  status: string
  expiresAt: Date | null
  expired: boolean
  templateVersion: string
  templateTitle: string
  templateSubtitle: string | null
  templateSections: TemplateSection[]
  templateHtml: string | null
  /** Presigned URL (15-min TTL) of the staff-uploaded source PDF. When set, the
   *  portal renders the PDF instead of templateSections/templateHtml. */
  uploadedPdfUrl: string | null
  /** Formatted deposit amount (`$300.00`) when a deposit applies; null otherwise. */
  depositAmount: string | null
  orgName: string
  leadFirstName: string
  /** v2 only. Null for legacy v1 agreements so the portal can branch. */
  firmSnapshot: PublicFirmSnapshot | null
  /** v2 only. Null for legacy v1. */
  clientSnapshot: PublicClientSnapshot | null
  /** CONSENT_7216 only. Keeps prefill explicit instead of inferring in portal. */
  consentPrefill: PublicConsentPrefill | null
}

/** Legacy alias retained for transitional callers. */
export type PublicNdaView = PublicAgreementView

export async function toPublicView(agreement: LoadedAgreement): Promise<PublicAgreementView> {
  const template = getTemplate(agreement.templateVersion)
  const depositAmount = agreement.depositAmount ? `$${agreement.depositAmount.toString()}` : null
  const uploadedPdfUrl = agreement.uploadedPdfKey
    ? await getSignedDownloadUrl(agreement.uploadedPdfKey, VIEW_PRESIGN_TTL_SECONDS)
    : null
  const fullName = [agreement.signer.firstName, agreement.signer.lastName].filter(Boolean).join(' ')
  const sections = template.render({
    leadFullName: fullName,
    orgName: agreement.organization.name,
    depositAmount: depositAmount ?? '',
    date: agreement.createdAt.toISOString().slice(0, 10),
    templateVersion: agreement.templateVersion,
    governingState: agreement.organization.governingState ?? undefined,
    governingCounty: agreement.organization.governingCounty ?? undefined,
    confidentialityYears: 'five (5)',
  })

  // v2 snapshot: only build when the row carries firm-side data (i.e. NDA v2
  // sent post-Phase-3). Legacy v1 NDAs return null so the portal renders the
  // pre-existing flow without a header block.
  const isV2 = Boolean(agreement.firmSignaturePngKey)

  let firmSnapshot: PublicFirmSnapshot | null = null
  let clientSnapshot: PublicClientSnapshot | null = null
  let consentPrefill: PublicConsentPrefill | null = null

  if (isV2) {
    const firmAddress = composeAddressLine({
      address: agreement.organization.address,
      city: agreement.organization.city,
      state: agreement.organization.state,
      zip: agreement.organization.zip,
    })
    const presignedUrl = agreement.firmSignaturePngKey
      ? await getSignedDownloadUrl(agreement.firmSignaturePngKey, VIEW_PRESIGN_TTL_SECONDS)
      : null
    const firmContact = composeContactLine({
      phone: getEffectiveFirmPhone(agreement.organization.firmPhone),
      email: agreement.organization.firmEmail,
      website: agreement.organization.firmWebsite,
    })

    firmSnapshot = {
      name: agreement.organization.name,
      address: firmAddress ?? '[Address not provided]',
      contact: firmContact,
      signerName: agreement.firmSignerName ?? '',
      signerTitle: agreement.firmSignerTitle ?? '',
      signaturePresignedUrl: presignedUrl,
      signedAt: agreement.firmSignedAt ? formatHumanDate(agreement.firmSignedAt) : null,
    }

    const clientType: 'INDIVIDUAL' | 'BUSINESS' = agreement.client?.clientType ?? 'INDIVIDUAL'
    const clientAddress =
      composeAddressLine({
        address: agreement.client?.businessAddress,
        city: agreement.client?.businessCity,
        state: agreement.client?.businessState,
        zip: agreement.client?.businessZip,
      }) ?? '[Address not provided]'

    clientSnapshot = {
      nameOrBusiness: resolveClientNameOrBusiness({
        firstName: agreement.signer.firstName,
        lastName: agreement.signer.lastName,
        client: agreement.client ? { clientType: agreement.client.clientType } : null,
        leadBusinessName: agreement.lead?.businessName ?? null,
      }),
      address: clientAddress,
      clientType,
    }
  }

  if (agreement.type === 'CONSENT_7216') {
    const taxpayerName = fullName.trim() || null
    const clientBusinessName =
      agreement.client?.clientType === 'BUSINESS'
        ? agreement.client.name?.trim() || agreement.client.firstName?.trim() || null
        : null
    consentPrefill = {
      taxpayerName,
      businessName: agreement.lead?.businessName?.trim() || clientBusinessName,
    }
  }

  return {
    type: agreement.type,
    status: agreement.status,
    expiresAt: agreement.expiresAt,
    expired: isExpired(agreement.expiresAt),
    templateVersion: agreement.templateVersion,
    templateTitle: agreement.title || template.title,
    templateSubtitle: agreement.type === 'CONSENT_7216' ? template.subtitle ?? null : null,
    templateSections: sections,
    // Sanitized at write time. Legacy templateSections kept for back-compat
    // with portal builds that don't yet read templateHtml. `|| null` (not
    // `??`) so empty strings collapse to null and the portal takes the legacy
    // render branch instead of an empty custom HTML block.
    templateHtml: agreement.customContentHtml || null,
    uploadedPdfUrl,
    depositAmount,
    orgName: agreement.organization.name,
    leadFirstName: agreement.signer.firstName,
    firmSnapshot,
    clientSnapshot,
    consentPrefill,
  }
}

export interface SignAgreementInput {
  token: string
  signerName: string
  signerTitle: string
  signaturePngDataUrl: string
  ip: string
  userAgent: string
  /** Back-compat: older portal builds supplied business rep fields. */
  clientAuthRepName?: string
  clientAuthRepTitle?: string
  taxpayerName?: string
  businessName?: string
  tinLastFour?: string
  consentSignerTitle?: string
}

function normalizeConsentFields(
  agreementType: string,
  input: Pick<SignAgreementInput, 'taxpayerName' | 'businessName' | 'tinLastFour'>
): {
  consentTaxpayerName?: string
  consentBusinessName?: string | null
  consentTinLastFour?: string
} {
  if (agreementType !== 'CONSENT_7216') return {}

  const taxpayerName = input.taxpayerName?.trim() ?? ''
  const businessName = input.businessName?.trim() || null
  const tinLastFour = input.tinLastFour?.trim() ?? ''

  if (taxpayerName.length < 2) {
    throw new HTTPException(400, { message: 'Taxpayer name is required' })
  }
  if (taxpayerName.length > 160) {
    throw new HTTPException(400, { message: 'Taxpayer name must be 160 characters or fewer' })
  }
  if (businessName && businessName.length > 200) {
    throw new HTTPException(400, { message: 'Business name must be 200 characters or fewer' })
  }
  if (!/^\d{4}$/.test(tinLastFour)) {
    throw new HTTPException(400, { message: 'TIN last four must be exactly 4 digits' })
  }

  return {
    consentTaxpayerName: taxpayerName,
    consentBusinessName: businessName,
    consentTinLastFour: tinLastFour,
  }
}

export async function signAgreement(input: SignAgreementInput) {
  const agreement = await loadAgreementByToken(input.token)
  if (!agreement) throw new HTTPException(404, { message: 'Agreement link not found' })

  const accessError = getPublicAgreementAccessError(agreement)
  if (accessError) throw new AgreementPublicAccessError(accessError)
  if (isExpired(agreement.expiresAt)) {
    throw new HTTPException(410, { message: 'Agreement link has expired' })
  }

  const isV2 = Boolean(agreement.firmSignaturePngKey)
  const signerName = input.signerName.trim()
  const signerTitle =
    agreement.type === 'CONSENT_7216'
      ? input.consentSignerTitle?.trim() || input.signerTitle.trim()
      : input.signerTitle.trim()
  const consentFields = normalizeConsentFields(agreement.type, input)

  if (signerName.length < 2 || signerTitle.length < 2) {
    throw new HTTPException(400, {
      message: 'Signer full name and title are required',
    })
  }

  // Server reads clientType from DB, never trusts the payload. INDIVIDUAL
  // signers do not get an auth-rep row, while BUSINESS signers use the same
  // full-name/title pair as authorized representative metadata.
  const dbClientType: 'INDIVIDUAL' | 'BUSINESS' = agreement.client?.clientType ?? 'INDIVIDUAL'
  const repName = input.clientAuthRepName?.trim() || signerName
  const repTitle = input.clientAuthRepTitle?.trim() || signerTitle
  if (dbClientType === 'BUSINESS' && (!repName || !repTitle)) {
    throw new HTTPException(400, {
      message: 'Authorized representative name and title are required for business clients',
    })
  }
  // For INDIVIDUAL clients, drop the auth-rep name; keep title because the
  // client signature block now requires it for every signer.
  const persistRepName = dbClientType === 'BUSINESS' ? repName : null
  const persistRepTitle = repTitle

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

  // v2: pull firm signature PNG bytes for the dual-signature block + build
  // header/signature snapshot inputs. Legacy v1 falls through with no extras.
  let firmSnapshot: Parameters<typeof generateSignedPdf>[0]['firmSnapshot']
  let clientSnapshot: Parameters<typeof generateSignedPdf>[0]['clientSnapshot']
  if (isV2) {
    const firmFetched = agreement.firmSignaturePngKey
      ? await fetchImageBuffer(agreement.firmSignaturePngKey)
      : null
    const firmAddressLine = composeAddressLine({
      address: agreement.organization.address,
      city: agreement.organization.city,
      state: agreement.organization.state,
      zip: agreement.organization.zip,
    })
    const firmContactLine = composeContactLine({
      phone: getEffectiveFirmPhone(agreement.organization.firmPhone),
      email: agreement.organization.firmEmail,
      website: agreement.organization.firmWebsite,
    })
    const clientAddressLine =
      composeAddressLine({
        address: agreement.client?.businessAddress,
        city: agreement.client?.businessCity,
        state: agreement.client?.businessState,
        zip: agreement.client?.businessZip,
      }) ?? '[Address not provided]'

    firmSnapshot = {
      name: agreement.organization.name,
      address: firmAddressLine ?? '[Address not provided]',
      contact: firmContactLine ?? undefined,
      signerName: agreement.firmSignerName ?? '',
      signerTitle: agreement.firmSignerTitle ?? '',
      signaturePngBuffer: firmFetched?.buffer,
      signedAt: agreement.firmSignedAt ? formatHumanDate(agreement.firmSignedAt) : undefined,
    }

    clientSnapshot = {
      nameOrBusiness: resolveClientNameOrBusiness({
        firstName: agreement.signer.firstName,
        lastName: agreement.signer.lastName,
        client: agreement.client ? { clientType: agreement.client.clientType } : null,
        leadBusinessName: agreement.lead?.businessName ?? null,
      }),
      address: clientAddressLine,
      clientType: dbClientType,
      authRepName: persistRepName ?? undefined,
      authRepTitle: persistRepTitle,
      signaturePngBuffer: decoded.buffer,
      signedAt: formatHumanDate(signedAt),
    }
  }

  // Uploaded-PDF path: keep the customer's source PDF intact and append a
  // generated Acceptance & Signature page. Native (HTML/template) path renders
  // the full document as before.
  let pdfBuffer: Buffer
  if (agreement.uploadedPdfKey) {
    if (!firmSnapshot || !clientSnapshot) {
      throw new HTTPException(500, {
        message: 'Uploaded agreement is missing its signing snapshot',
      })
    }
    const basePdf = await fetchFileBuffer(agreement.uploadedPdfKey)
    if (!basePdf) {
      throw new HTTPException(502, { message: 'Could not load the uploaded agreement PDF' })
    }
    const signaturePage = await generateSignaturePagePdf({
      documentTitle: agreement.title,
      orgName: agreement.organization.name,
      firmSnapshot,
      clientSnapshot,
      depositAmountLabel: agreement.depositAmount ? `$${agreement.depositAmount.toString()}` : null,
      audit: { ipAddress: input.ip, userAgent: input.userAgent, signedAt },
    })
    pdfBuffer = await appendPagesToPdf(basePdf, signaturePage)
  } else {
    pdfBuffer = await generateSignedPdf({
      agreement: {
        type: agreement.type,
        templateVersion: agreement.templateVersion,
        depositAmount: agreement.depositAmount ?? '0.00',
        customContentHtml: agreement.customContentHtml,
        title: agreement.title,
      },
      lead: { firstName: agreement.signer.firstName, lastName: agreement.signer.lastName },
      organization: {
        name: agreement.organization.name,
        governingState: agreement.organization.governingState,
        governingCounty: agreement.organization.governingCounty,
      },
      signature: {
        pngBuffer: decoded.buffer,
        typedName: signerName,
        ipAddress: input.ip,
        userAgent: input.userAgent,
        signedAt,
      },
      firmSnapshot,
      clientSnapshot,
      consentFields:
        agreement.type === 'CONSENT_7216'
          ? {
              taxpayerName: consentFields.consentTaxpayerName!,
              businessName: consentFields.consentBusinessName,
              tinLastFour: consentFields.consentTinLastFour!,
              signerTitle,
            }
          : undefined,
    })
  }

  await uploadFile(signedPdfKey, pdfBuffer, 'application/pdf')

  const result = await prisma.agreement.updateMany({
    where: { id: agreement.id, status: 'SENT', isActive: true },
    data: {
      status: 'SIGNED',
      signedAt,
      signerName,
      signerIpAddress: input.ip,
      signerUserAgent: input.userAgent,
      signaturePngKey,
      signedPdfKey,
      clientAuthRepName: persistRepName,
      clientAuthRepTitle: persistRepTitle,
      ...consentFields,
      isActive: false,
      lastUsedAt: signedAt,
      usageCount: { increment: 1 },
    },
  })

  if (result.count === 0) {
    await deleteGeneratedSigningArtifacts([signaturePngKey, signedPdfKey])

    const latest = await prisma.agreement.findUnique({
      where: { id: agreement.id },
      select: { status: true, isActive: true, type: true },
    })
    if (latest) {
      const latestAccessError = getPublicAgreementAccessError(latest)
      if (latestAccessError) throw new AgreementPublicAccessError(latestAccessError)
    }
    throw new HTTPException(409, { message: 'Agreement was already signed' })
  }

  // Post-commit side effects (admin SMS, deposit Payment + client pay link).
  // Fire-and-forget: must NEVER fail or delay the signing response.
  runPostSignSideEffects({
    id: agreement.id,
    organizationId: agreement.organizationId,
    orgName: agreement.organization.name,
    title: agreement.title,
    createdByUserId: agreement.createdByUserId,
    leadId: agreement.leadId,
    clientId: agreement.clientId,
    depositAmount: agreement.depositAmount,
    depositStatus: agreement.depositStatus,
    signer: agreement.signer,
  })
  const paymentPortalResult = await runAgreementQuotePostSignSideEffect({
    agreementId: agreement.id,
    organizationId: agreement.organizationId,
    staffId: agreement.sentByUserId ?? agreement.createdByUserId,
    paymentPortalMode: agreement.paymentPortalMode,
    paymentQuoteId: agreement.paymentQuoteId,
  })

  const downloadUrl = await getSignedDownloadUrl(signedPdfKey, DOWNLOAD_TTL_SECONDS)
  return {
    status: 'SIGNED' as const,
    signedAt,
    downloadUrl,
    ...(paymentPortalResult
      ? {
          paymentPortalUrl: paymentPortalResult.payUrl,
          paymentPortalDelivery: {
            mode: 'AUTO_SEND' as const,
            smsSent: paymentPortalResult.smsSent,
            smsSkippedReason: paymentPortalResult.smsSkippedReason,
          },
        }
      : {}),
  }
}

/**
 * Post-sign side effects, fired AFTER the signing transaction commits. Each
 * step is independently caught + logged — a Twilio outage or payment-create
 * failure never breaks the signing response.
 */
function runPostSignSideEffects(ctx: PostSignAgreementContext): void {
  notifyAdminsAgreementSigned(ctx).catch((err) => {
    console.error(`[Agreement] Post-sign admin notification failed for agreement=${ctx.id}:`, err)
  })
  createDepositPaymentForAgreement(ctx).catch((err) => {
    console.error(`[Agreement] Post-sign deposit payment hook failed for agreement=${ctx.id}:`, err)
  })
}

async function runAgreementQuotePostSignSideEffect(input: {
  agreementId: string
  organizationId: string
  staffId: string | null
  paymentPortalMode: string
  paymentQuoteId: string | null
}): Promise<AgreementQuoteActivationResult | null> {
  if (!input.paymentQuoteId) return null
  if (input.paymentPortalMode === 'STAFF_REVIEW') {
    try {
      await markAgreementQuoteSignedForReview({
        agreementId: input.agreementId,
        organizationId: input.organizationId,
      })
    } catch (err) {
      console.error(
        `[Agreement] Post-sign quote review marker failed for agreement=${input.agreementId}:`,
        err,
      )
    }
    return null
  }
  if (input.paymentPortalMode !== 'AUTO_SEND' || !input.staffId) return null

  try {
    return await activateAgreementQuotePaymentPortal({
      agreementId: input.agreementId,
      orgId: input.organizationId,
      staffId: input.staffId,
    })
  } catch (err) {
    console.error(
      `[Agreement] Post-sign quote activation failed for agreement=${input.agreementId}:`,
      err,
    )
    return null
  }
}

/** Legacy alias retained for transitional callers + tests. */
export const signNda = signAgreement
