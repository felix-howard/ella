/**
 * SharedDocsTab - Multi-section document sharing container
 * Lists section cards + "Add Section" button. Empty state when no docs.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Loader2, Plus, RefreshCw, FileText } from 'lucide-react'
import { Button } from '@ella/ui'
import { useSharedDocs } from '../../hooks/use-shared-docs'
import { SharedDocCard } from './shared-doc-card'
import { AddSectionInlineForm } from './add-section-inline-form'

interface SharedDocsTabProps {
  caseId: string
  clientName: string
}

export function SharedDocsTab({ caseId, clientName }: SharedDocsTabProps) {
  const { t } = useTranslation()
  const { documents, isLoading, error, refetch } = useSharedDocs({ caseId })
  const [isAdding, setIsAdding] = useState(false)

  const hasDocuments = documents.length > 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          {t('sharedDocs.heading')}
        </h2>
        {!isAdding && !isLoading && !error && (
          <Button variant="default" size="sm" onClick={() => setIsAdding(true)} className="gap-1.5">
            <Plus className="w-4 h-4" />
            {t('sharedDocs.addSection')}
          </Button>
        )}
      </div>

      {isAdding && (
        <AddSectionInlineForm
          caseId={caseId}
          onComplete={() => {
            setIsAdding(false)
            refetch()
          }}
          onCancel={() => setIsAdding(false)}
        />
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && error && (
        <div className="bg-card rounded-xl border border-destructive/30 p-6">
          <div className="flex flex-col items-center text-center py-6">
            <AlertCircle className="w-10 h-10 text-destructive mb-3" />
            <h3 className="text-base font-medium text-foreground mb-1">
              {t('common.error')}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {error instanceof Error ? error.message : t('clientDetail.sharedDocsError')}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              {t('common.retry')}
            </Button>
          </div>
        </div>
      )}

      {!isLoading && !error && !hasDocuments && !isAdding && (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-1">
            {t('sharedDocs.emptyTitle')}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t('sharedDocs.emptyDesc', { name: clientName })}
          </p>
          <Button variant="default" size="sm" onClick={() => setIsAdding(true)} className="gap-1.5">
            <Plus className="w-4 h-4" />
            {t('sharedDocs.addSection')}
          </Button>
        </div>
      )}

      {!isLoading && !error && documents.map((doc) => (
        <SharedDocCard key={doc.id} document={doc} caseId={caseId} />
      ))}
    </div>
  )
}
