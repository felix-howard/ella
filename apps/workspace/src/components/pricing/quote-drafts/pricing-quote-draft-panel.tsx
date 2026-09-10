import { useEffect, useId, useRef, useState } from 'react'
import {
  Button,
  Modal,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Select,
} from '@ella/ui'
import type { PricingCalculatorInput } from '@ella/shared/pricing'
import type { PricingQuoteDraftDetail, PricingQuoteDraftSummary } from '../../../lib/api-client'
import { toast } from '../../../stores/toast-store'
import { formatCurrency } from '../pricing-format'
import { canonicalizePricingQuoteDraftInput } from './pricing-quote-draft-types'
import { PricingQuoteDraftSaveModal } from './pricing-quote-draft-save-modal'
import { PricingQuoteDraftStatus } from './pricing-quote-draft-status'
import type { PricingQuoteDraftAutosaveState } from './use-pricing-quote-draft-autosave'
import { usePricingQuoteDraftMutations, usePricingQuoteDrafts } from './use-pricing-quote-drafts'

export interface PricingQuoteDraftPanelProps {
  input: PricingCalculatorInput
  activeDraft: Pick<PricingQuoteDraftSummary, 'id' | 'name' | 'updatedAt'> | null
  hasUnsavedChanges: boolean
  autosaveState: PricingQuoteDraftAutosaveState
  disabled?: boolean
  managementDisabled?: boolean
  onSaved: (draft: PricingQuoteDraftDetail, savedInput: PricingCalculatorInput) => void
  onLoad: (draft: PricingQuoteDraftDetail) => void
  onRenamed: (draft: PricingQuoteDraftDetail) => void
  onDeleted: (id: string) => void
  onNewQuote: () => void
  onRetryAutosave: () => void
  onReloadActiveDraft: () => void
  onBusyChange?: (busy: boolean) => void
}

type Confirmation = { kind: 'load' | 'delete'; draft: PricingQuoteDraftSummary } | { kind: 'new' }

export function PricingQuoteDraftPanel({
  input,
  activeDraft,
  hasUnsavedChanges,
  autosaveState,
  disabled = false,
  managementDisabled = false,
  onSaved,
  onLoad,
  onRenamed,
  onDeleted,
  onNewQuote,
  onRetryAutosave,
  onReloadActiveDraft,
  onBusyChange,
}: PricingQuoteDraftPanelProps) {
  const id = useId()
  const [selectedId, setSelectedId] = useState(activeDraft?.id ?? '')
  const [saveMode, setSaveMode] = useState<'save' | PricingQuoteDraftSummary | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const query = usePricingQuoteDrafts()
  const { create, update, remove, load } = usePricingQuoteDraftMutations()
  const drafts = query.data?.drafts ?? []
  const selected = drafts.find((draft) => draft.id === selectedId) ?? null
  const busy = create.isPending || update.isPending || remove.isPending || load.isPending
  const locked = disabled || managementDisabled || busy
  const newQuoteButtonRef = useRef<HTMLButtonElement>(null)
  const dialogWasOpen = useRef(false)
  const dialogOpen = Boolean(saveMode || confirmation)
  useEffect(() => {
    onBusyChange?.(busy)
  }, [busy, onBusyChange])

  useEffect(() => {
    // A successful save removes its trigger; deleting disables its trigger.
    // Keep keyboard users in the panel when Modal cannot restore that focus.
    if (dialogWasOpen.current && !dialogOpen) {
      const focused = document.activeElement
      if (focused === document.body || focused?.hasAttribute('disabled')) {
        newQuoteButtonRef.current?.focus()
      }
    }
    dialogWasOpen.current = dialogOpen
  }, [dialogOpen])

  const perform = async (action: Confirmation) => {
    setActionError(null)
    try {
      if (action.kind === 'load') {
        const detail = await load.mutateAsync(action.draft.id)
        onLoad(detail)
        setSelectedId(detail.id)
        toast.success(`${detail.name} loaded`)
      } else if (action.kind === 'delete') {
        await remove.mutateAsync(action.draft.id)
        onDeleted(action.draft.id)
        setSelectedId('')
        toast.success('Quote draft deleted')
      } else {
        onNewQuote()
        setSelectedId('')
      }
      setConfirmation(null)
    } catch (error) {
      if (action.kind === 'load') setSelectedId(activeDraft?.id ?? '')
      setActionError(error instanceof Error ? error.message : 'Could not update quote draft.')
    }
  }

  const requestAction = (action: Confirmation) => {
    setActionError(null)
    if (action.kind === 'delete' || hasUnsavedChanges) setConfirmation(action)
    else void perform(action)
  }

  const cancelConfirmation = () => {
    if (confirmation?.kind === 'load') setSelectedId(activeDraft?.id ?? '')
    setConfirmation(null)
  }

  const save = async (name: string) => {
    if (saveMode === 'save') {
      const snapshot = canonicalizePricingQuoteDraftInput(input)
      const detail = await create.mutateAsync({ name, pricingInput: snapshot })
      onSaved(detail, snapshot)
      setSelectedId(detail.id)
      toast.success('Quote draft saved')
    } else if (saveMode) {
      const detail = await update.mutateAsync({
        id: saveMode.id,
        data: {
          name,
          expectedUpdatedAt:
            activeDraft?.id === saveMode.id ? activeDraft.updatedAt : saveMode.updatedAt,
        },
      })
      onRenamed(detail)
      toast.success('Quote draft renamed')
    }
    setSaveMode(null)
  }

  return (
    <section
      className="rounded-lg border border-border bg-card p-4"
      aria-labelledby={`${id}-title`}
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id={`${id}-title`} className="text-sm font-semibold text-foreground">
            Quote drafts
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Save a Calculator setup and return to it later.
          </p>
          {activeDraft && (
            <p className="mt-1 text-xs text-muted-foreground" role="status">
              {activeDraft.name} ·{' '}
              <PricingQuoteDraftStatus
                state={autosaveState}
                onRetry={onRetryAutosave}
                onReload={onReloadActiveDraft}
                disabled={disabled || busy}
              />
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {!activeDraft && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSaveMode('save')}
              disabled={locked}
            >
              Save draft
            </Button>
          )}
          <Button
            ref={newQuoteButtonRef}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => requestAction({ kind: 'new' })}
            disabled={locked}
          >
            New quote
          </Button>
        </div>
      </header>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Select
          className="min-w-0 flex-1"
          value={selected?.id ?? ''}
          onChange={(event) => {
            const draft = drafts.find((candidate) => candidate.id === event.target.value)
            setSelectedId(event.target.value)
            if (draft) requestAction({ kind: 'load', draft })
          }}
          disabled={locked || query.isLoading || drafts.length === 0}
          placeholder={query.isLoading ? 'Loading drafts...' : 'Choose a quote draft...'}
          options={drafts.map((draft) => ({ value: draft.id, label: draft.name }))}
          aria-label="Choose a quote draft"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={locked || !selected}
            onClick={() => {
              if (selected) setSaveMode(selected)
            }}
          >
            Rename
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-error"
            disabled={locked || !selected}
            onClick={() => {
              if (selected) requestAction({ kind: 'delete', draft: selected })
            }}
          >
            Delete
          </Button>
        </div>
      </div>
      {query.isLoading && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          Loading quote drafts...
        </p>
      )}
      {query.isError ? (
        <div role="alert" className="mt-2 text-xs text-error">
          Could not load quote drafts.{' '}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={query.isFetching}
            onClick={() => {
              void query.refetch()
            }}
          >
            Retry
          </Button>
        </div>
      ) : (
        !query.isLoading &&
        drafts.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">No quote drafts saved yet.</p>
        )
      )}
      {selected && <p className="mt-2 text-xs text-muted-foreground">{draftLabel(selected)}</p>}
      {actionError && !confirmation && (
        <p role="alert" className="mt-2 text-xs text-error">
          {actionError}
        </p>
      )}
      {saveMode && (
        <PricingQuoteDraftSaveModal
          mode={saveMode === 'save' ? 'save' : 'rename'}
          initialName={saveMode === 'save' ? '' : saveMode.name}
          isPending={busy}
          onClose={() => setSaveMode(null)}
          onSave={save}
        />
      )}
      <Modal
        open={Boolean(confirmation)}
        onClose={() => {
          if (!busy) cancelConfirmation()
        }}
        showCloseButton={false}
        aria-labelledby={`${id}-confirm-title`}
        aria-describedby={`${id}-confirm-description`}
      >
        <ModalHeader>
          <ModalTitle id={`${id}-confirm-title`}>
            {confirmation?.kind === 'delete' ? 'Delete quote draft?' : 'Discard unsaved changes?'}
          </ModalTitle>
          <ModalDescription id={`${id}-confirm-description`}>
            {confirmation?.kind === 'delete'
              ? `Delete “${confirmation.draft.name}”? This cannot be undone. Current Calculator values will be kept.`
              : 'Your current unsaved Calculator changes will be replaced.'}
          </ModalDescription>
        </ModalHeader>
        {actionError && (
          <p role="alert" className="text-xs text-error">
            {actionError}
          </p>
        )}
        <ModalFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={cancelConfirmation}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || disabled}
            onClick={() => {
              if (confirmation) void perform(confirmation)
            }}
          >
            {busy
              ? 'Working...'
              : confirmation?.kind === 'delete'
                ? 'Delete draft'
                : confirmation?.kind === 'new'
                  ? 'Discard and start new'
                  : 'Discard and load'}
          </Button>
        </ModalFooter>
      </Modal>
    </section>
  )
}

function draftLabel(draft: PricingQuoteDraftSummary): string {
  return `${draft.name} · ${formatCurrency((draft.setupTotalCents + draft.monthlyTotalCents) / 100)} due today · ${formatCurrency(draft.monthlyTotalCents / 100)}/month · Updated ${new Date(draft.updatedAt).toLocaleString('en-US')}`
}
