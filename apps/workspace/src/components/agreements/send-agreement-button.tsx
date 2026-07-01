/**
 * "Send Agreement" action button. Click opens the 3-step send wizard:
 *   1. Type picker (NDA / Engagement Letter / Consent / Custom)
 *   2. Template picker (NDA auto-skips with built-in template)
 *   3. Content editor + metadata (title, deposit, internal note)
 *
 * Top-level button is type-agnostic — only `noPhone` and `notAdmin` reasons
 * gate it. Type-specific gates (NDA active-engagement / pending invite) are
 * surfaced inside the wizard's Step 1 type picker, since they only apply when
 * the user actually picks NDA. Other types are always sendable in parallel.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilePenLine, Plus, Send } from 'lucide-react'
import {
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@ella/ui'
import { AgreementSendWizard } from './agreement-send-wizard'
import { AgreementDraftResumeModal } from './agreement-draft-resume-modal'
import { AgreementSourceBadge, AgreementTypeBadge } from './agreement-status-badges'
import { formatShortRelativeTime } from '../../lib/formatters'
import type { Agreement } from '../../lib/api-client'
import type { EntityRef, Recipient } from './types'

type DisabledReason = 'noPhone' | 'notAdmin'

interface Props {
  entity: EntityRef
  recipient: Recipient
  agreements: Agreement[]
  /** Override computed disabled state — used for role-based UI gating (server is source of truth). */
  forceDisabledReason?: 'notAdmin'
}

function computeDisabledReason(recipient: Recipient): DisabledReason | null {
  if (!recipient.phone || !recipient.phone.trim()) return 'noPhone'
  return null
}

export function SendAgreementButton({ entity, recipient, agreements, forceDisabledReason }: Props) {
  const { t, i18n } = useTranslation()
  const [wizardOpen, setWizardOpen] = useState(false)
  const [choiceOpen, setChoiceOpen] = useState(false)
  const [resumeDraft, setResumeDraft] = useState<Agreement | null>(null)

  const disabledReason = useMemo(
    () => forceDisabledReason ?? computeDisabledReason(recipient),
    [forceDisabledReason, recipient],
  )
  const disabled = disabledReason !== null
  const drafts = useMemo(
    () => agreements
      .filter((agreement) => agreement.status === 'DRAFT')
      .sort((left, right) =>
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      ),
    [agreements],
  )

  const tooltip = disabledReason ? t(`nda.send.disabled.${disabledReason}`) : undefined
  const openSendFlow = () => {
    if (drafts.length > 0) {
      setChoiceOpen(true)
      return
    }
    setWizardOpen(true)
  }

  const openDraft = (draft: Agreement) => {
    setChoiceOpen(false)
    setResumeDraft(draft)
  }

  const startNewAgreement = () => {
    setChoiceOpen(false)
    setWizardOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={openSendFlow}
        disabled={disabled}
        title={tooltip}
        className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Send className="w-4 h-4" />
        {t('agreements.send.button')}
      </button>

      {wizardOpen && (
        <AgreementSendWizard
          entity={entity}
          recipient={recipient}
          agreements={agreements}
          onClose={() => setWizardOpen(false)}
        />
      )}

      <Modal
        open={choiceOpen}
        onClose={() => setChoiceOpen(false)}
        size="lg"
        aria-labelledby="agreement-draft-choice-title"
        aria-describedby="agreement-draft-choice-description"
      >
        <ModalHeader>
          <ModalTitle id="agreement-draft-choice-title">
            {t('agreements.draft.choice.title')}
          </ModalTitle>
          <ModalDescription id="agreement-draft-choice-description">
            {t('agreements.draft.choice.description')}
          </ModalDescription>
        </ModalHeader>
        <ModalBody className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t('agreements.draft.choice.continueExisting')}
          </p>
          {drafts.slice(0, 3).map((draft) => (
            <button
              key={draft.id}
              type="button"
              onClick={() => openDraft(draft)}
              className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/60"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <FilePenLine className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">{draft.title}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t('agreements.draft.choice.updated', {
                      time: formatShortRelativeTime(draft.updatedAt, i18n.language),
                    })}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <AgreementTypeBadge type={draft.type} />
                  <AgreementSourceBadge source={draft.source} />
                </div>
              </div>
            </button>
          ))}
        </ModalBody>
        <ModalFooter className="flex-col-reverse sm:flex-row">
          <button
            type="button"
            onClick={() => setChoiceOpen(false)}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={startNewAgreement}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Plus className="h-4 w-4" />
            {t('agreements.draft.choice.startNew')}
          </button>
        </ModalFooter>
      </Modal>

      <AgreementDraftResumeModal
        entity={entity}
        draft={resumeDraft}
        open={Boolean(resumeDraft)}
        onClose={() => setResumeDraft(null)}
      />
    </>
  )
}
