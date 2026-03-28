import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { PDF_FONT_FAMILY } from '../../lib/pdf-fonts'
import { TERMS_CONTENT, type TermsContent, type TermsLanguage } from './terms-content'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 11,
    lineHeight: 1.5,
  },
  header: {
    marginBottom: 20,
    textAlign: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  version: {
    fontSize: 10,
    color: '#666',
  },
  section: {
    marginBottom: 16,
  },
  heading: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  paragraph: {
    marginBottom: 6,
    textAlign: 'justify',
  },
  signatureBlock: {
    marginTop: 30,
    borderTop: '1px solid #ccc',
    paddingTop: 20,
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  signatureField: {
    width: '45%',
  },
  signatureLabel: {
    fontSize: 10,
    color: '#666',
    marginBottom: 4,
  },
  signatureImage: {
    width: 200,
    height: 80,
    objectFit: 'contain',
  },
  acknowledgment: {
    marginTop: 20,
  },
  timestamp: {
    marginTop: 10,
    fontSize: 10,
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
  language: TermsLanguage
  signatureDataUrl: string
  staffName: string
  signedAt: Date
}

export function TermsPDFDocument({ language, signatureDataUrl, staffName, signedAt }: TermsPDFDocumentProps) {
  const content: TermsContent = TERMS_CONTENT[language]
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
              <Text style={styles.signatureLabel}>
                {language === 'EN' ? 'Signature' : 'Ch\u1EEF k\u00FD'}
              </Text>
              {validSignature && (
                <Image src={signatureDataUrl} style={styles.signatureImage} />
              )}
            </View>
            <View style={styles.signatureField}>
              <Text style={styles.signatureLabel}>
                {language === 'EN' ? 'Full Name' : 'H\u1ECD v\u00E0 t\u00EAn'}
              </Text>
              <Text>{staffName}</Text>
            </View>
          </View>

          <Text style={styles.timestamp}>
            {language === 'EN' ? 'Signed on' : 'K\u00FD ng\u00E0y'}: {formatSignedDate(signedAt, language)}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
