import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X } from 'lucide-react'
import { useCreateAgreement } from '../agreements/use-agreement-mutations'
import { useNdaReadiness } from '../agreements/use-nda-readiness'
import { NdaSetupRequiredCard } from '../agreements/nda-setup-required-card'
import {
  Step3ContentEditor,
  type Step3Draft,
  type Step3Resolved,
} from '../agreements/wizard-steps/step3-content-editor'
import type { EntityRef } from '../agreements/types'
import {
  createCalculatorEngagementLetterDraft,
  submitCalculatorEngagementLetter,
} from './calculator-engagement-letter-modal-helpers'

interface CalculatorEngagementLetterModalProps {
  entity: EntityRef
  recipientLabel: string
  recipientHint?: string
  contentHtml: string
  onClose: () => void
}

export function CalculatorEngagementLetterModal({
  entity,
  recipientLabel,
  recipientHint,
  contentHtml,
  onClose,
}: CalculatorEngagementLetterModalProps) {
  const mutation = useCreateAgreement(entity)
  const readinessQuery = useNdaReadiness('ENGAGEMENT_LETTER')
  const [draft, setDraft] = useState<Step3Draft>(() =>
    createCalculatorEngagementLetterDraft(contentHtml),
  )

  const setupMissing =
    readinessQuery.isError || (readinessQuery.data ? !readinessQuery.data.ready : false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !mutation.isPending) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mutation.isPending, onClose])

  const handleSubmit = (resolved: Step3Resolved) => {
    submitCalculatorEngagementLetter(resolved, mutation, onClose)
  }

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[10000] bg-black/50"
        onClick={() => !mutation.isPending && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="calculator-engagement-letter-title"
        className="fixed left-1/2 top-1/2 z-[10001] flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <h3
              id="calculator-engagement-letter-title"
              className="text-lg font-semibold text-foreground"
            >
              Edit & send
            </h3>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {recipientLabel}
              {recipientHint ? ` · ${recipientHint}` : ''} · Calculator Engagement Letter
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            aria-label="Close engagement letter editor"
            className="rounded-md p-1.5 transition-colors hover:bg-muted disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {readinessQuery.isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {!readinessQuery.isLoading && setupMissing && (
            <NdaSetupRequiredCard
              missing={readinessQuery.data?.missing ?? []}
              isRefreshing={readinessQuery.isFetching}
              hasError={readinessQuery.isError}
              onClose={onClose}
            />
          )}
          {!readinessQuery.isLoading && !setupMissing && (
            <Step3ContentEditor
              entity={entity}
              type="ENGAGEMENT_LETTER"
              templateId={null}
              isSubmitting={mutation.isPending}
              draft={draft}
              onDraftChange={setDraft}
              onCancel={onClose}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}
