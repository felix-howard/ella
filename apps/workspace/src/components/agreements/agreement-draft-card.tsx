import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilePenLine, Loader2, Trash2 } from 'lucide-react'
import { NdaReadonlyCard } from './agreement-readonly-card'
import { AgreementDraftResumeModal } from './agreement-draft-resume-modal'
import { useDiscardAgreementDraft } from './use-agreement-draft-mutations'
import type { Agreement } from '../../lib/api-client'
import type { EntityRef } from './types'

interface AgreementDraftCardProps {
  entity: EntityRef
  draft: Agreement
}

export function AgreementDraftCard({ entity, draft }: AgreementDraftCardProps) {
  const { t } = useTranslation()
  const [resumeOpen, setResumeOpen] = useState(false)
  const discardMutation = useDiscardAgreementDraft(entity)

  const handleDiscard = () => {
    if (!window.confirm(t('agreements.draft.discardConfirm', { title: draft.title }))) return
    discardMutation.mutate({
      agreementId: draft.id,
      payload: { expectedUpdatedAt: draft.updatedAt },
    })
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-colors hover:border-border">
      <NdaReadonlyCard nda={draft} framed={false} />

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-3">
        <button
          type="button"
          onClick={() => setResumeOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <FilePenLine className="w-3.5 h-3.5" />
          {t('agreements.draft.resume')}
        </button>
        <button
          type="button"
          onClick={handleDiscard}
          disabled={discardMutation.isPending}
          className="flex items-center gap-1.5 rounded-full border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
        >
          {discardMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
          {t('agreements.draft.discard')}
        </button>
      </div>

      <AgreementDraftResumeModal
        entity={entity}
        draft={draft}
        open={resumeOpen}
        onClose={() => setResumeOpen(false)}
      />
    </div>
  )
}
