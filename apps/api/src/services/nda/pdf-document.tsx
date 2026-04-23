/**
 * React-PDF <Document> component that renders a signed NDA.
 * Pure view layer — no I/O, no side effects. Consumed by pdf-generator.tsx.
 */
import { Document, Image, Page, Text, View } from '@react-pdf/renderer'
import type { NdaTemplate, PdfSignatureInput, TemplateVars } from '../../lib/nda/types'
import { pdfStyles as s } from './pdf-styles'

interface NdaPdfDocumentProps {
  template: NdaTemplate
  vars: TemplateVars
  signature: PdfSignatureInput
}

export function NdaPdfDocument({ template, vars, signature }: NdaPdfDocumentProps) {
  const sections = template.render(vars)
  const signedAtIso = signature.signedAt.toISOString()

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

        {sections.map((section) => (
          <View key={section.heading} style={s.section} wrap={false}>
            <Text style={s.heading}>{section.heading}</Text>
            {section.paragraphs.map((p, i) => (
              <Text key={i} style={s.paragraph}>
                {p}
              </Text>
            ))}
          </View>
        ))}

        <View style={s.signatureBlock} wrap={false}>
          <Text style={s.signatureLabel}>Signature</Text>
          <Image src={signature.pngBuffer} style={s.signatureImage} />

          <Text style={s.signatureLabel}>Printed Name</Text>
          <Text style={s.signatureValue}>{signature.typedName}</Text>

          <Text style={s.auditRow}>Signed at: {signedAtIso}</Text>
          <Text style={s.auditRow}>IP address: {signature.ipAddress}</Text>
          <Text style={s.auditRow}>User agent: {signature.userAgent}</Text>
        </View>

        <Text
          style={s.footer}
          render={({ pageNumber, totalPages }) =>
            `Template ${vars.templateVersion} — Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  )
}
