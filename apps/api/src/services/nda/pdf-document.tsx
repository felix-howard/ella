/**
 * React-PDF <Document> component that renders a signed NDA.
 * Pure view layer — no I/O, no side effects. Consumed by pdf-generator.tsx.
 *
 * Two body sources, picked at the call site:
 *   - Default (no `bodyNodes`): walk `template.render(vars)` like before.
 *   - Custom HTML: caller passes pre-built `bodyNodes` from `htmlToPdfNodes`.
 *
 * Two render modes:
 *   - 'signed' (default): full audit footer + signature block.
 *   - 'preview': suppress signature/audit, swap footer to PREVIEW marker.
 */
import { Document, Image, Page, Text, View } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import type { NdaTemplate, PdfSignatureInput, TemplateVars } from '../../lib/nda/types'
import { pdfStyles as s } from './pdf-styles'

export type NdaPdfMode = 'signed' | 'preview'

interface NdaPdfDocumentProps {
  template: NdaTemplate
  vars: TemplateVars
  signature: PdfSignatureInput
  /** Pre-built body nodes (custom HTML path). Falls back to template render when absent. */
  bodyNodes?: ReactElement[]
  mode?: NdaPdfMode
}

export function NdaPdfDocument({
  template,
  vars,
  signature,
  bodyNodes,
  mode = 'signed',
}: NdaPdfDocumentProps) {
  const signedAtIso = signature.signedAt.toISOString()
  const isPreview = mode === 'preview'

  return (
    <Document
      title={template.title}
      author={vars.orgName}
      creationDate={signature.signedAt}
      modificationDate={signature.signedAt}
    >
      <Page size="LETTER" style={s.page} wrap>
        <Text style={s.title}>{template.title}</Text>
        <Text style={s.subtitle}>
          {vars.orgName} — {vars.date}
        </Text>

        {bodyNodes
          ? bodyNodes
          : template.render(vars).map((section) => (
              <View key={section.heading} style={s.section} wrap={false}>
                <Text style={s.heading}>{section.heading}</Text>
                {section.paragraphs.map((p, i) => (
                  <Text key={i} style={s.paragraph}>
                    {p}
                  </Text>
                ))}
              </View>
            ))}

        {!isPreview && (
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

        <Text
          style={s.footer}
          render={({ pageNumber, totalPages }) =>
            isPreview
              ? `PREVIEW — NOT A SIGNED DOCUMENT — Page ${pageNumber} of ${totalPages}`
              : `Template ${vars.templateVersion} — Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  )
}
