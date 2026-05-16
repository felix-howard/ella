/**
 * React-PDF <Document> component that renders a signed NDA.
 * Pure view layer — no I/O, no side effects. Consumed by pdf-generator.tsx.
 *
 * Two body sources, picked at the call site:
 *   - Default (no `bodyNodes`): walk `template.render(vars)` like before.
 *   - Custom HTML: caller passes pre-built `bodyNodes` from `htmlToPdfNodes`.
 *
 * Three render modes:
 *   - 'signed' (default): full audit footer + signature block.
 *   - 'preview': suppress signature/audit, swap footer to PREVIEW marker.
 *   - 'view': v2 only — Firm signed, Client pending.
 *
 * Version branching:
 *   - v1 path: legacy single-signer block + audit footer (unchanged).
 *   - v2 path: headerBlock before body + signatureBlock after body.
 */
import { Document, Image, Page, Text, View } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import React from 'react'
import type { NdaTemplate, PdfSignatureInput, TemplateVars } from '../../lib/agreements/types'
import { pdfStyles as s } from './pdf-styles'

export type NdaPdfMode = 'signed' | 'preview' | 'view'

interface NdaPdfDocumentProps {
  template: NdaTemplate
  vars: TemplateVars
  /** Required for v1 path. Optional for v2 (signature rendered via signatureBlock). */
  signature: PdfSignatureInput
  /** Pre-built body nodes (custom HTML path). Falls back to template render when absent. */
  bodyNodes?: ReactElement[]
  mode?: NdaPdfMode
  /** Override the rendered title. When omitted, falls back to `template.title`. */
  title?: string
  /** v2: subtitle tagline rendered below the title. */
  subtitle?: string
  /** v2: Parties block rendered before body sections. */
  headerBlock?: ReactElement
  /** v2: Section 21 signature block appended after body sections. */
  signatureBlock?: ReactElement
}

export function NdaPdfDocument({
  template,
  vars,
  signature,
  bodyNodes,
  mode = 'signed',
  title,
  subtitle,
  headerBlock,
  signatureBlock,
}: NdaPdfDocumentProps) {
  const signedAtIso = signature.signedAt.toISOString()
  const isPreview = mode === 'preview'
  const isV2 = !!headerBlock || !!signatureBlock
  const heading = title?.trim() || template.title

  return (
    <Document
      title={heading}
      author={vars.orgName}
      creationDate={signature.signedAt}
      modificationDate={signature.signedAt}
    >
      <Page size="LETTER" style={s.page} wrap>
        {/* Title — shared across v1 and v2 */}
        <Text style={s.title}>{heading}</Text>

        {/* v2: styled tagline subtitle; v1: org name + date */}
        {isV2 ? (
          subtitle ? (
            <Text style={s.v2Subtitle}>{subtitle}</Text>
          ) : null
        ) : (
          <Text style={s.subtitle}>
            {vars.orgName} — {vars.date}
          </Text>
        )}

        {/* v2: Parties / Header block before body */}
        {headerBlock ?? null}

        {/* Body sections */}
        {bodyNodes
          ? bodyNodes
          : template.render(vars).map((section, idx) => (
              <View key={`${section.heading}-${idx}`} style={s.section} wrap={false}>
                <Text style={s.heading}>{section.heading}</Text>
                {section.paragraphs.map((p, i) => (
                  <Text key={i} style={s.paragraph}>
                    {p}
                  </Text>
                ))}
              </View>
            ))}

        {/* v2: Section 21 signature block after body */}
        {signatureBlock ?? null}

        {/* v1 legacy: single-signer block + audit footer */}
        {!isV2 && !isPreview && (
          <View style={s.signatureBlock} wrap={false}>
            <Text style={s.signatureLabel}>Signature</Text>
            <Image src={signature.pngBuffer} style={s.signatureImage} />

            <Text style={s.signatureLabel}>Printed Name</Text>
            <Text style={s.signatureValue}>{signature.typedName}</Text>

            <Text style={s.auditRow}>Signed at: {signedAtIso}</Text>
            <Text style={s.auditRow}>IP address: {signature.ipAddress}</Text>
            <Text style={s.auditRow}>User agent: {signature.userAgent}</Text>
          </View>
        )}

        <Text style={s.footer} fixed>
          {isPreview ? 'PREVIEW — NOT A SIGNED DOCUMENT' : `Template ${vars.templateVersion}`}
        </Text>
      </Page>
    </Document>
  )
}
