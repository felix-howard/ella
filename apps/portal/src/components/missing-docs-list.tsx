/**
 * Missing Docs List Component - Simplified
 * Displays list of needed documents from checklist
 * Clean, minimal design per Phase 2 requirements
 */
import { useTranslation } from 'react-i18next'
import { FileText } from 'lucide-react'
import type { ChecklistDoc } from '../lib/api-client'

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

/**
 * Get localized label for document
 * Falls back to sanitized labelVi or formatted docType
 */
function getDocLabel(doc: ChecklistDoc): string {
  // Use labelVi for Vietnamese, labelVi fallback for English (until API adds labelEn)
  const label = doc.labelVi || doc.docType.replace(/_/g, ' ')
  return sanitizeText(label)
}

export function MissingDocsList({ docs }: MissingDocsListProps) {
  const { t } = useTranslation()

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
            <FileText
              className="w-5 h-5 text-muted-foreground shrink-0"
              aria-hidden="true"
            />
            <span className="text-sm">{getDocLabel(doc)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
