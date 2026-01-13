/**
 * Missing Docs List Component
 * Displays list of missing required documents
 * Prominent styling to encourage client action
 */
import { memo } from 'react'
import { FileQuestion, Upload, AlertCircle } from 'lucide-react'
import { Button } from '@ella/ui'
import { getText, type Language } from '../../lib/i18n'
import type { ChecklistDoc } from '../../lib/api-client'

interface MissingDocsListProps {
  docs: ChecklistDoc[]
  language: Language
  onUploadClick?: () => void
}

export const MissingDocsList = memo(function MissingDocsList({
  docs,
  language,
  onUploadClick,
}: MissingDocsListProps) {
  const t = getText(language)

  if (docs.length === 0) return null

  return (
    <div
      className="rounded-2xl border-2 border-dashed border-error/30 bg-error/5 overflow-hidden"
      role="region"
      aria-label={t.missing}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-error/20">
        <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center">
          <AlertCircle className="w-5 h-5 text-error" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">{t.missing}</h3>
          <p className="text-sm text-error">
            {docs.length} {language === 'VI' ? 'tài liệu cần gửi' : 'documents needed'}
          </p>
        </div>
      </div>

      {/* Missing docs list */}
      <div className="p-4 space-y-2" role="list" aria-label="Missing documents">
        {docs.map((doc) => (
          <MissingDocItem key={doc.id} doc={doc} />
        ))}
      </div>

      {/* Upload CTA */}
      {onUploadClick && (
        <div className="p-4 pt-0">
          <Button
            className="w-full h-14 rounded-2xl text-base gap-2"
            onClick={onUploadClick}
          >
            <Upload className="w-5 h-5" aria-hidden="true" />
            {t.uploadDocs}
          </Button>
        </div>
      )}
    </div>
  )
})

// Individual missing doc item
const MissingDocItem = memo(function MissingDocItem({
  doc,
}: {
  doc: ChecklistDoc
}) {
  const docLabel = doc.labelVi || doc.docType.replace(/_/g, ' ')

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl bg-white/50 border border-error/10"
      role="listitem"
      aria-label={docLabel}
    >
      <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center shrink-0">
        <FileQuestion className="w-4 h-4 text-error" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground text-sm truncate">
          {docLabel}
        </p>
        <p className="text-xs text-muted-foreground">
          {doc.docType.replace(/_/g, '-')}
        </p>
      </div>
    </div>
  )
})

export default MissingDocsList
