import { useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Modal,
  ModalBody,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from '@ella/ui'
import { AgreementDraftEditor } from './agreement-draft-editor'
import type { Agreement } from '../../lib/api-client'
import type { EntityRef } from './types'

interface AgreementDraftResumeModalProps {
  entity: EntityRef
  draft: Agreement | null
  open: boolean
  onClose: () => void
}

export function AgreementDraftResumeModal({
  entity,
  draft,
  open,
  onClose,
}: AgreementDraftResumeModalProps) {
  const { t } = useTranslation()
  const closeGuardRef = useRef<(() => boolean) | null>(null)

  const registerCloseGuard = useCallback((guard: (() => boolean) | null) => {
    closeGuardRef.current = guard
  }, [])

  const requestClose = useCallback(() => {
    if (closeGuardRef.current && !closeGuardRef.current()) return
    onClose()
  }, [onClose])

  if (!draft) return null

  return (
    <Modal
      open={open}
      onClose={requestClose}
      size="full"
      className="w-[calc(100vw-2rem)] max-w-6xl"
      aria-labelledby="agreement-draft-resume-title"
      aria-describedby="agreement-draft-resume-description"
    >
      <ModalHeader>
        <ModalTitle id="agreement-draft-resume-title">{draft.title}</ModalTitle>
        <ModalDescription id="agreement-draft-resume-description">
          {t('agreements.draft.resumeDescription')}
        </ModalDescription>
      </ModalHeader>
      <ModalBody className="p-0">
        <AgreementDraftEditor
          entity={entity}
          type={draft.type}
          templateId={draft.templateId}
          source={draft.source}
          sourceSnapshot={draft.sourceSnapshot ?? undefined}
          existingDraft={draft}
          onClose={onClose}
          registerCloseGuard={registerCloseGuard}
        />
      </ModalBody>
    </Modal>
  )
}
