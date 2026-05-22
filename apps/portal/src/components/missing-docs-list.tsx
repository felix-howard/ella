/**
 * Missing Docs List Component - Simplified
 * Displays list of needed documents from checklist
 * Clean, minimal design per Phase 2 requirements
 */
import { useTranslation } from 'react-i18next'
import { FileText } from 'lucide-react'
import type { ChecklistDoc } from '../lib/api-client'
import type { TFunction } from 'i18next'

interface MissingDocsListProps {
  docs: ChecklistDoc[]
}

/**
 * Sanitize text to prevent XSS - strip HTML tags
 * API labels should be plain text, but sanitize for defense-in-depth
 */
function sanitizeText(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim()
}

const DOC_TYPE_KEYS: Record<string, string> = {
  SSN_CARD: 'docType.ssnCard',
  DRIVER_LICENSE: 'docType.driverLicense',
  PASSPORT: 'docType.passport',
  W2: 'docType.w2',
  FORM_1099_INT: 'docType.form1099Int',
  FORM_1099_DIV: 'docType.form1099Div',
  FORM_1099_NEC: 'docType.form1099Nec',
  FORM_1099_MISC: 'docType.form1099Misc',
  FORM_1099_K: 'docType.form1099K',
  FORM_1099_R: 'docType.form1099R',
  FORM_1099_G: 'docType.form1099G',
  FORM_1099_SSA: 'docType.form1099Ssa',
  BANK_STATEMENT: 'docType.bankStatement',
  PROFIT_LOSS_STATEMENT: 'docType.profitLossStatement',
  BUSINESS_LICENSE: 'docType.businessLicense',
  EIN_LETTER: 'docType.einLetter',
  FORM_1098: 'docType.form1098',
  FORM_1098_T: 'docType.form1098T',
  RECEIPT: 'docType.receipt',
  BIRTH_CERTIFICATE: 'docType.birthCertificate',
  DAYCARE_RECEIPT: 'docType.daycareReceipt',
  FORM_1040: 'docType.form1040',
  FORM_1040_SR: 'docType.form1040Sr',
  FORM_1040_NR: 'docType.form1040Nr',
  FORM_1040_X: 'docType.form1040X',
  STATE_TAX_RETURN: 'docType.stateTaxReturn',
  FOREIGN_TAX_RETURN: 'docType.foreignTaxReturn',
  TAX_RETURN_TRANSCRIPT: 'docType.taxReturnTranscript',
  OTHER: 'docType.other',
  UNKNOWN: 'docType.unknown',
}

function formatDocType(docType: string): string {
  return docType
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')
}

function getDocLabel(doc: ChecklistDoc, t: TFunction, isVi: boolean): string {
  const key = DOC_TYPE_KEYS[doc.docType]
  if (key) {
    const translated = t(key)
    if (translated !== key) return sanitizeText(translated)
  }

  const label = isVi ? doc.labelVi : formatDocType(doc.docType)
  return sanitizeText(label)
}

export function MissingDocsList({ docs }: MissingDocsListProps) {
  const { i18n, t } = useTranslation()
  const isVi = i18n.resolvedLanguage?.startsWith('vi') || i18n.language.startsWith('vi')

  // Empty state - all docs received
  if (docs.length === 0) {
    return (
      <div className="text-center py-8" role="status" aria-live="polite">
        <p className="text-muted-foreground">{t('portal.noDocsNeeded')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3" role="region" aria-label={t('portal.docsNeeded')}>
      <h2 className="text-lg font-semibold">{t('portal.docsNeeded')}</h2>
      <ul className="space-y-2" role="list">
        {docs.map((doc) => (
          <li
            key={doc.id}
            className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl"
            role="listitem"
          >
            <FileText className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden="true" />
            <span className="text-sm">{getDocLabel(doc, t, isVi)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
