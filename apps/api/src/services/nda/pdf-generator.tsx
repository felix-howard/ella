/**
 * Server-side NDA PDF generator.
 *
 * Entry point consumed by the signing endpoint (Phase 03). Byte-identical
 * output for the same inputs — PDF metadata dates are pinned to `signedAt`
 * so audit re-render produces the same bytes.
 */
import { renderToBuffer } from '@react-pdf/renderer'
import { htmlToPdfNodes } from '../../lib/nda/html-to-pdf'
import { getTemplate } from '../../lib/nda/template-registry'
import type { PdfSignatureInput, TemplateVars } from '../../lib/nda/types'
import { NdaPdfDocument, type NdaPdfMode } from './pdf-document'

/** Cap UA at a sensible length so the audit row never overflows the PDF frame. */
const MAX_USER_AGENT_LENGTH = 256

export interface GenerateSignedPdfInput {
  ndaAgreement: {
    templateVersion: string
    depositAmount: { toString(): string } | number | string
    /** When set, body renders from sanitized HTML instead of templateVersion. */
    customContentHtml?: string | null
  }
  lead: {
    firstName: string | null
    lastName: string | null
  }
  organization: {
    name: string
  }
  signature: PdfSignatureInput
  /** 'preview' suppresses signature block + audit footer. Default 'signed'. */
  mode?: NdaPdfMode
}

function formatDepositAmount(amount: GenerateSignedPdfInput['ndaAgreement']['depositAmount']): string {
  const raw = typeof amount === 'number' ? amount.toFixed(2) : amount.toString()
  const numeric = Number(raw)
  if (!Number.isFinite(numeric)) {
    throw new Error(`Invalid deposit amount: ${raw}`)
  }
  return `$${numeric.toFixed(2)}`
}

function formatFullName(lead: GenerateSignedPdfInput['lead']): string {
  const parts = [lead.firstName, lead.lastName].filter((p): p is string => !!p && p.trim().length > 0)
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

export async function generateSignedPdf(input: GenerateSignedPdfInput): Promise<Buffer> {
  const template = getTemplate(input.ndaAgreement.templateVersion)

  const vars: TemplateVars = {
    leadFullName: formatFullName(input.lead),
    orgName: input.organization.name,
    depositAmount: formatDepositAmount(input.ndaAgreement.depositAmount),
    date: formatDate(input.signature.signedAt),
    templateVersion: template.version,
  }

  const signature: PdfSignatureInput = {
    ...input.signature,
    userAgent: truncateUserAgent(input.signature.userAgent),
  }

  const bodyNodes = input.ndaAgreement.customContentHtml
    ? htmlToPdfNodes(input.ndaAgreement.customContentHtml)
    : undefined

  return renderToBuffer(
    <NdaPdfDocument
      template={template}
      vars={vars}
      signature={signature}
      bodyNodes={bodyNodes}
      mode={input.mode ?? 'signed'}
    />,
  )
}
