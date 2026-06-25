import { FileText, Loader2, Save } from 'lucide-react'
import type { AgreementDraftAutosaveState } from '../use-agreement-draft-autosave'

interface AgreementEditorActionsProps {
  canSubmit: boolean
  isSubmitting: boolean
  isDraftSaved?: boolean
  draftSaveState?: AgreementDraftAutosaveState
  draftMetadata?: string | null
  conflictMessage?: string | null
  sendBlockedReason?: string | null
  onOpenPreview: () => void
  onCancel: () => void
  onSaveDraft?: () => void
  onReloadDraft?: () => void
  t: (key: string, options?: Record<string, unknown>) => string
}

function draftStateLabel(
  state: AgreementDraftAutosaveState | undefined,
  t: AgreementEditorActionsProps['t'],
): string {
  switch (state) {
    case 'saving':
      return t('agreements.draft.state.saving')
    case 'unsaved':
      return t('agreements.draft.state.unsaved')
    case 'failed':
      return t('agreements.draft.state.failed')
    case 'conflict':
      return t('agreements.draft.state.conflict')
    case 'saved':
      return t('agreements.draft.state.saved')
    default:
      return t('agreements.draft.state.idle')
  }
}

export function AgreementEditorActions({
  canSubmit,
  isSubmitting,
  isDraftSaved = false,
  draftSaveState = 'idle',
  draftMetadata,
  conflictMessage,
  sendBlockedReason,
  onOpenPreview,
  onCancel,
  onSaveDraft,
  onReloadDraft,
  t,
}: AgreementEditorActionsProps) {
  const showDraftControls = Boolean(onSaveDraft)
  const saveDisabled = isSubmitting || draftSaveState === 'saving' || draftSaveState === 'conflict'
  const submitDisabled = !canSubmit || Boolean(sendBlockedReason)

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
      {conflictMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          <p>{conflictMessage}</p>
          {onReloadDraft && (
            <button
              type="button"
              onClick={onReloadDraft}
              className="mt-2 rounded-full border border-amber-300 px-3 py-1 font-medium text-amber-900 transition-colors hover:bg-amber-100"
            >
              {t('agreements.draft.reload')}
            </button>
          )}
        </div>
      )}

      {showDraftControls && !isDraftSaved && (
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={!canSubmit || saveDisabled}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
        >
          {draftSaveState === 'saving' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {t('agreements.draft.saveCta')}
        </button>
      )}

      {showDraftControls && isDraftSaved && (
        <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs leading-5 text-muted-foreground">
          <span className="font-medium text-foreground">
            {draftStateLabel(draftSaveState, t)}
          </span>
          {draftMetadata && <span className="ml-1">{draftMetadata}</span>}
        </div>
      )}

      <button
        type="button"
        onClick={onOpenPreview}
        disabled={submitDisabled}
        title={sendBlockedReason ?? undefined}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        {t('nda.editor.previewAndSend')}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={isSubmitting}
        className="min-h-10 rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
      >
        {t('common.cancel')}
      </button>
    </div>
  )
}
