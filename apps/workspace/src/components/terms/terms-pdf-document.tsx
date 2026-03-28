import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { PDF_FONT_FAMILY } from '../../lib/pdf-fonts'
import { TERMS_CONTENT, type TermsContent, type TermsLanguage } from './terms-content'

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 9,
    lineHeight: 1.4,
  },
  header: {
    marginBottom: 10,
    textAlign: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  version: {
    fontSize: 8,
    color: '#666',
  },
  section: {
    marginBottom: 6,
  },
  heading: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  paragraph: {
    marginBottom: 3,
    textAlign: 'justify',
  },
  signatureBlock: {
    marginTop: 12,
    borderTop: '1px solid #ccc',
    paddingTop: 10,
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  signatureField: {
    width: '45%',
  },
  signatureLabel: {
    fontSize: 8,
    color: '#666',
    marginBottom: 3,
  },
  signatureImage: {
    width: 150,
    height: 60,
    objectFit: 'contain',
  },
  acknowledgment: {
    marginTop: 10,
    fontWeight: 'bold',
  },
  timestamp: {
    marginTop: 6,
    fontSize: 8,
    color: '#666',
  },
})

/** Deterministic date formatting for PDF (no locale dependency) */
function formatSignedDate(date: Date, lang: TermsLanguage): string {
  const months_en = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  const day = date.getDate()
  const month = date.getMonth()
  const year = date.getFullYear()
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')

  if (lang === 'VI') {
    return `${day} th\u00E1ng ${month + 1}, ${year} ${hours}:${minutes}`
  }
  return `${months_en[month]} ${day}, ${year} ${hours}:${minutes}`
}

function isValidSignatureDataUrl(url: string): boolean {
  return url.startsWith('data:image/png;base64,') || url.startsWith('data:image/')
}

interface TermsPDFDocumentProps {
  language?: TermsLanguage
  signatureDataUrl: string
  staffName: string
  signedAt: Date
}

export function TermsPDFDocument({ signatureDataUrl, staffName, signedAt }: TermsPDFDocumentProps) {
  // PDF is always generated in English
  const content: TermsContent = TERMS_CONTENT['EN']
  const validSignature = signatureDataUrl && isValidSignatureDataUrl(signatureDataUrl)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.version}>
            Version: {content.version} | Effective: {content.effectiveDate}
          </Text>
        </View>

        {content.sections.map((section, idx) => (
          <View key={idx} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
            {section.paragraphs.map((para, pIdx) => (
              <Text key={pIdx} style={styles.paragraph}>{para}</Text>
            ))}
          </View>
        ))}

        <View style={styles.signatureBlock}>
          <Text style={styles.acknowledgment}>{content.acknowledgment}</Text>

          <View style={styles.signatureRow}>
            <View style={styles.signatureField}>
              <Text style={styles.signatureLabel}>Signature</Text>
              {validSignature && (
                <Image src={signatureDataUrl} style={styles.signatureImage} />
              )}
            </View>
            <View style={styles.signatureField}>
              <Text style={styles.signatureLabel}>Full Name</Text>
              <Text>{staffName}</Text>
            </View>
          </View>

          <Text style={styles.timestamp}>
            Signed on: {formatSignedDate(signedAt, 'EN')}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
