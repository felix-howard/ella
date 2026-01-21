/**
 * Missing Docs List Component - Simplified
 * Displays list of needed documents from checklist
 * Clean, minimal design per Phase 2 requirements
 */
import { FileText } from 'lucide-react'
import type { ChecklistDoc } from '../lib/api-client'
import { getText, type Language } from '../lib/i18n'

interface MissingDocsListProps {
  docs: ChecklistDoc[]
  language: Language
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
 * Note: language param reserved for future API labelEn support
 */
function getDocLabel(doc: ChecklistDoc, _language: Language): string {
  // Use labelVi for Vietnamese, labelVi fallback for English (until API adds labelEn)
  const label = doc.labelVi || doc.docType.replace(/_/g, ' ')
  return sanitizeText(label)
}

export function MissingDocsList({ docs, language }: MissingDocsListProps) {
  const t = getText(language)

  // Empty state - all docs received
  if (docs.length === 0) {
    return (
      <div className="text-center py-8" role="status" aria-live="polite">
        <p className="text-muted-foreground">{t.noDocsNeeded}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3" role="region" aria-label={t.docsNeeded}>
      <h2 className="text-lg font-semibold">{t.docsNeeded}</h2>
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
            <span className="text-sm">{getDocLabel(doc, language)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
