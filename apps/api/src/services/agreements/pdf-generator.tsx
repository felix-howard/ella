/**
 * Server-side agreement PDF generator.
 *
 * Entry point consumed by the signing endpoint. Byte-identical output for the
 * same inputs — PDF metadata dates are pinned to `signedAt` so audit
 * re-render produces the same bytes.
 *
 * Version branching:
 *   templateVersion === 'v1' → legacy path (unchanged).
 *   templateVersion === 'v2' → HeaderBlock + SignatureBlock injected.
 */
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { htmlToPdfNodes } from '../../lib/agreements/html-to-pdf'
import { getTemplate } from '../../lib/agreements/template-registry'
import type { PdfSignatureInput, TemplateVars } from '../../lib/agreements/types'
import type { AgreementType } from '@ella/db'
import { PdfConsentAuthorizationBlock } from './pdf-consent-authorization-block'
import { PdfHeaderBlock } from './pdf-header-block'
import { PdfSignatureBlock, type PdfSignatureMode } from './pdf-signature-block'
import { NdaPdfDocument, type NdaPdfMode } from './pdf-document'

/** Cap UA at a sensible length so the audit row never overflows the PDF frame. */
const MAX_USER_AGENT_LENGTH = 256

// ── v2-specific input types ───────────────────────────────────────────────

export interface FirmSnapshot {
  name: string
  /** Full composed address string: "123 Main St, Houston, TX 77001" */
  address: string
  /** Optional composed contact string: "phone | email | website" */
  contact?: string
  signerName: string
  signerTitle: string
  /** PNG bytes from R2. Required in 'signed'/'view' modes. */
  signaturePngBuffer?: Buffer
  /** Formatted date string (e.g. "May 6, 2026"). */
  signedAt?: string
}

export interface ClientSnapshot {
  nameOrBusiness: string
  /** Full composed address string. "[Address]" in preview. */
  address: string
  clientType: 'INDIVIDUAL' | 'BUSINESS'
  /** BUSINESS-only signer name row. The typed signerName is also stored in audit metadata. */
  authRepName?: string
  /** Required signer title rendered in the client signature block for all client types. */
  authRepTitle?: string
  /** PNG bytes from R2. Required in 'signed' mode. */
  signaturePngBuffer?: Buffer
  /** Formatted date string. */
  signedAt?: string
}

export interface Consent7216Fields {
  taxpayerName: string
  businessName?: string | null
  tinLastFour: string
  signerTitle: string
}

// ── Main input interface ──────────────────────────────────────────────────

export interface GenerateSignedPdfInput {
  agreement: {
    type?: AgreementType
    templateVersion: string
    depositAmount: { toString(): string } | number | string
    /** When set, body renders from sanitized HTML instead of templateVersion. */
    customContentHtml?: string | null
    /** Override the PDF heading. Defaults to template.title when omitted. */
    title?: string | null
  }
  lead: {
    firstName: string | null
    lastName: string | null
  }
  organization: {
    name: string
    /** v2: state whose law governs the agreement. */
    governingState?: string | null
    /** v2: "{County}, {State}" locality string. */
    governingCounty?: string | null
  }
  signature: PdfSignatureInput
  /** 'preview' suppresses signature block + audit footer. Default 'signed'. */
  mode?: NdaPdfMode
  /** v2: firm identity + signature data snapshotted at agreement creation. */
  firmSnapshot?: FirmSnapshot
  /** v2: client identity + signature data. */
  clientSnapshot?: ClientSnapshot
  /** CONSENT_7216: taxpayer fields collected during signing. */
  consentFields?: Consent7216Fields
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDepositAmount(amount: GenerateSignedPdfInput['agreement']['depositAmount']): string {
  const raw = typeof amount === 'number' ? amount.toFixed(2) : amount.toString()
  const numeric = Number(raw)
  if (!Number.isFinite(numeric)) {
    throw new Error(`Invalid deposit amount: ${raw}`)
  }
  return `$${numeric.toFixed(2)}`
}

function formatFullName(lead: GenerateSignedPdfInput['lead']): string {
  const parts = [lead.firstName, lead.lastName].filter(
    (p): p is string => !!p && p.trim().length > 0
  )
  return parts.join(' ').trim() || 'Unnamed Lead'
}

function formatDate(date: Date): string {
  // Stable across Node locales via ISO slice (UTC). Phase 03+ can localise if needed.
  return date.toISOString().slice(0, 10)
}

function truncateUserAgent(ua: string): string {
  if (ua.length <= MAX_USER_AGENT_LENGTH) return ua
  return `${ua.slice(0, MAX_USER_AGENT_LENGTH - 3)}...`
}

export function shouldRenderAgreementPdfHeader(type?: AgreementType): boolean {
  return type !== 'ENGAGEMENT_LETTER' && type !== 'CONSENT_7216'
}

export function resolveAgreementPdfSubtitle(
  type: AgreementType | undefined,
  subtitle?: string
): string | undefined {
  return type === 'ENGAGEMENT_LETTER' ? undefined : subtitle
}

// ── Main export ───────────────────────────────────────────────────────────

export async function generateSignedPdf(input: GenerateSignedPdfInput): Promise<Buffer> {
  const template = getTemplate(input.agreement.templateVersion)
  const mode = input.mode ?? 'signed'
  const isConsent7216 = input.agreement.type === 'CONSENT_7216'
  const usesDualSignature = Boolean(input.firmSnapshot || input.clientSnapshot)

  const vars: TemplateVars = {
    leadFullName: formatFullName(input.lead),
    orgName: input.organization.name,
    depositAmount: formatDepositAmount(input.agreement.depositAmount),
    date: formatDate(input.signature.signedAt),
    templateVersion: template.version,
    governingState: input.organization.governingState ?? undefined,
    governingCounty: input.organization.governingCounty ?? undefined,
    confidentialityYears: 'five (5)',
  }

  const signature: PdfSignatureInput = {
    ...input.signature,
    userAgent: truncateUserAgent(input.signature.userAgent),
  }

  const bodyNodes = input.agreement.customContentHtml
    ? htmlToPdfNodes(input.agreement.customContentHtml)
    : undefined
  const heading = input.agreement.title?.trim() || template.title

  if (isConsent7216) {
    if (input.agreement.customContentHtml?.trim()) {
      throw new Error('CONSENT_7216 PDF uses the built-in consent document')
    }
    if (mode === 'signed' && !input.consentFields) {
      throw new Error('CONSENT_7216 signed PDF requires consent fields')
    }

    const signedAt = formatDate(signature.signedAt)
    const authorizationBlock = (
      <PdfConsentAuthorizationBlock
        mode={mode}
        taxpayerName={input.consentFields?.taxpayerName}
        businessName={input.consentFields?.businessName}
        tinLastFour={input.consentFields?.tinLastFour}
        signaturePngBuffer={signature.pngBuffer}
        printedName={signature.typedName}
        title={input.consentFields?.signerTitle}
        signedAt={signedAt}
        audit={{
          signedAtIso: signature.signedAt.toISOString(),
          ipAddress: signature.ipAddress,
          userAgent: signature.userAgent,
        }}
      />
    )

    return renderToBuffer(
      <NdaPdfDocument
        template={template}
        vars={vars}
        signature={signature}
        mode={mode}
        title={template.title}
        subtitle={template.subtitle}
        signatureBlock={authorizationBlock}
      />
    )
  }

  // ── v2 path: inject HeaderBlock + SignatureBlock ──────────────────────────
  if (usesDualSignature) {
    const sigMode: PdfSignatureMode =
      mode === 'preview' ? 'preview' : mode === 'view' ? 'view' : 'signed'

    const firm = input.firmSnapshot
    const client = input.clientSnapshot
    const headerBlock = shouldRenderAgreementPdfHeader(input.agreement.type) ? (
      <PdfHeaderBlock
        agreementLabel={
          input.agreement.type === 'NDA' || !input.agreement.type
            ? 'Confidentiality and Non-Disclosure Agreement ("Agreement")'
            : heading
        }
        date={firm?.signedAt ?? '[Date]'}
        firmName={firm?.name ?? input.organization.name}
        firmAddress={firm?.address ?? '[Address]'}
        firmContact={firm?.contact}
        clientNameOrBusiness={client?.nameOrBusiness ?? formatFullName(input.lead)}
        clientAddress={client?.address ?? '[Address]'}
      />
    ) : undefined

    const signatureBlock = (
      <PdfSignatureBlock
        mode={sigMode}
        heading={
          input.agreement.type === 'ENGAGEMENT_LETTER'
            ? 'Acceptance and Signature'
            : '21. Signatures'
        }
        firmName={firm?.name ?? input.organization.name}
        firmSignerName={firm?.signerName ?? ''}
        firmSignerTitle={firm?.signerTitle ?? ''}
        firmSignaturePngBuffer={firm?.signaturePngBuffer}
        firmSignedAt={firm?.signedAt}
        clientType={client?.clientType ?? 'INDIVIDUAL'}
        clientNameOrBusiness={client?.nameOrBusiness ?? formatFullName(input.lead)}
        clientAuthRepName={client?.authRepName}
        clientAuthRepTitle={client?.authRepTitle}
        clientSignaturePngBuffer={client?.signaturePngBuffer}
        clientSignedAt={client?.signedAt}
      />
    )

    return renderToBuffer(
      <NdaPdfDocument
        template={template}
        vars={vars}
        signature={signature}
        bodyNodes={bodyNodes}
        mode={mode}
        title={input.agreement.title ?? undefined}
        subtitle={resolveAgreementPdfSubtitle(input.agreement.type, template.subtitle)}
        headerBlock={headerBlock}
        signatureBlock={signatureBlock}
      />
    )
  }

  // ── v1 legacy path ────────────────────────────────────────────────────────
  return renderToBuffer(
    <NdaPdfDocument
      template={template}
      vars={vars}
      signature={signature}
      bodyNodes={bodyNodes}
      mode={mode}
      title={input.agreement.title ?? undefined}
    />
  )
}
