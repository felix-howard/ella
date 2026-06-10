/**
 * Standalone "Acceptance and Signature" page for the upload-your-own-PDF flow.
 *
 * Unlike `pdf-generator.tsx` (which renders the whole agreement body from HTML),
 * this renders ONLY a signature page as its own one-page PDF. It is then merged
 * onto the end of the staff-uploaded source PDF via `pdf-merge.ts`. The original
 * uploaded pages are never re-rendered, so their layout is preserved exactly.
 *
 * Reuses `PdfSignatureBlock` (dual firm/client column) so the appended page is
 * visually consistent with natively-generated agreements.
 */
import { renderToBuffer } from '@react-pdf/renderer'
import { Document, Page, Text, View } from '@react-pdf/renderer'
import React from 'react'
import { pdfStyles as s } from './pdf-styles'
import { PdfSignatureBlock } from './pdf-signature-block'
import type { FirmSnapshot, ClientSnapshot } from './pdf-generator'

/** Cap UA so the audit row never overflows the page frame. */
const MAX_USER_AGENT_LENGTH = 256

function truncateUserAgent(ua: string): string {
  if (ua.length <= MAX_USER_AGENT_LENGTH) return ua
  return `${ua.slice(0, MAX_USER_AGENT_LENGTH - 3)}...`
}

export interface SignaturePageInput {
  /** Title of the agreement the page is attached to (shown in the reference line). */
  documentTitle: string
  /** Organization name — PDF metadata author. */
  orgName: string
  firmSnapshot: FirmSnapshot
  clientSnapshot: ClientSnapshot
  /** Formatted deposit amount (e.g. `$500.00`) when a deposit applies; null otherwise. */
  depositAmountLabel: string | null
  audit: {
    ipAddress: string
    userAgent: string
    /** Signing timestamp — also pins the PDF metadata dates for stable bytes. */
    signedAt: Date
  }
}

function SignaturePageDocument(input: SignaturePageInput) {
  const { firmSnapshot, clientSnapshot, audit } = input
  const signedAtIso = audit.signedAt.toISOString()

  return (
    <Document
      title={`${input.documentTitle} — Signature Page`}
      author={input.orgName}
      creationDate={audit.signedAt}
      modificationDate={audit.signedAt}
    >
      <Page size="LETTER" style={s.page} wrap>
        <Text style={s.title}>Acceptance and Signature</Text>
        <Text style={s.subtitle}>
          This signature page is attached to and forms part of: {input.documentTitle}
        </Text>

        {input.depositAmountLabel ? (
          <Text style={s.paragraph}>
            An initial payment of {input.depositAmountLabel} applies to this engagement
            and is payable as set out in the attached agreement.
          </Text>
        ) : null}

        <PdfSignatureBlock
          mode="signed"
          heading="Acceptance and Signature"
          firmName={firmSnapshot.name}
          firmSignerName={firmSnapshot.signerName}
          firmSignerTitle={firmSnapshot.signerTitle}
          firmSignaturePngBuffer={firmSnapshot.signaturePngBuffer}
          firmSignedAt={firmSnapshot.signedAt}
          clientType={clientSnapshot.clientType}
          clientNameOrBusiness={clientSnapshot.nameOrBusiness}
          clientAuthRepName={clientSnapshot.authRepName}
          clientAuthRepTitle={clientSnapshot.authRepTitle}
          clientSignaturePngBuffer={clientSnapshot.signaturePngBuffer}
          clientSignedAt={clientSnapshot.signedAt}
        />

        <View style={s.signatureBlock} wrap={false}>
          <Text style={s.auditRow}>Signed at: {signedAtIso}</Text>
          <Text style={s.auditRow}>IP address: {audit.ipAddress}</Text>
          <Text style={s.auditRow}>User agent: {truncateUserAgent(audit.userAgent)}</Text>
        </View>

        <Text style={s.footer} fixed>
          Electronically signed via Ella
        </Text>
      </Page>
    </Document>
  )
}

/** Render the standalone signature page to PDF bytes. */
export async function generateSignaturePagePdf(input: SignaturePageInput): Promise<Buffer> {
  return renderToBuffer(<SignaturePageDocument {...input} />)
}
