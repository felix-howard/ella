/**
 * Draft Return Tab - Main component for managing draft tax return sharing
 * States: Empty (no draft), Summary (active draft with link)
 */
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@ella/ui'
import { useDraftReturn } from '../../hooks/use-draft-return'
import { DraftReturnEmptyState } from './draft-return-empty-state'
import { DraftReturnSummary } from './draft-return-summary'

interface DraftReturnTabProps {
  caseId: string
  clientName: string
}

export function DraftReturnTab({ caseId, clientName }: DraftReturnTabProps) {
  const { draftReturn, magicLink, versions, isLoading, error, refetch } = useDraftReturn({
    caseId,
    enabled: true,
  })

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="bg-card rounded-xl border border-destructive/30 p-6">
        <div className="flex flex-col items-center text-center py-6">
          <AlertCircle className="w-10 h-10 text-destructive mb-3" />
          <h3 className="text-base font-medium text-foreground mb-1">Error loading data</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {error instanceof Error ? error.message : 'Could not load draft return data'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Try again
          </Button>
        </div>
      </div>
    )
  }

  // State 1: No draft exists - show upload prompt
  if (!draftReturn) {
    return <DraftReturnEmptyState caseId={caseId} clientName={clientName} onUploadSuccess={refetch} />
  }

  // State 2: Draft exists - show summary with actions
  return (
    <DraftReturnSummary
      draftReturn={draftReturn}
      magicLink={magicLink}
      versions={versions}
      caseId={caseId}
      onActionComplete={refetch}
    />
  )
}

export { DraftReturnEmptyState } from './draft-return-empty-state'
export { DraftReturnSummary } from './draft-return-summary'
