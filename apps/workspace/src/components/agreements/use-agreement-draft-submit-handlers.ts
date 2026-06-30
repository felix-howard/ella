import { useCallback } from 'react'
import type {
  Agreement,
  AgreementPaymentPortalSendMode,
  AgreementSource,
  AgreementType,
  CalculatorAgreementQuotePayload,
  CreateAgreementPayload,
  SaveAgreementDraftPayload,
  SendAgreementDraftPayload,
} from '../../lib/api-client'
import {
  buildCreateAgreementPayload,
  buildSaveAgreementDraftPayload,
  buildSendAgreementDraftPayload,
} from './agreement-draft-payload'
import { isAgreementDraftConflict } from './use-agreement-draft-mutations'
import type {
  Step3Resolved,
} from './wizard-steps/step3-content-editor'

interface UseAgreementDraftSubmitHandlersInput {
  type: AgreementType
  templateId: string | null
  effectiveTemplateId: string | null
  source: AgreementSource
  sourceSnapshot?: Record<string, unknown>
  calculatorQuote?: CalculatorAgreementQuotePayload
  paymentPortalMode?: AgreementPaymentPortalSendMode
  savedAgreement: Agreement | null
  createMutation: {
    mutate: (payload: CreateAgreementPayload, options: { onSuccess: () => void }) => void
  }
  saveDraftMutation: {
    mutate: (
      payload: SaveAgreementDraftPayload,
      options: { onSuccess: (res: { data: Agreement }) => void },
    ) => void
  }
  sendDraftMutation: {
    mutate: (
      input: { agreementId: string; payload: SendAgreementDraftPayload },
      options: { onSuccess: () => void; onError: (error: unknown) => void },
    ) => void
  }
  resetSavedBaseline: (payload: SaveAgreementDraftPayload) => void
  setSavedDraft: (agreement: Agreement, resolved: Step3Resolved) => void
  setConflictMessage: (message: string | null) => void
  onClose: () => void
  conflictMessage: string
}

export function useAgreementDraftSubmitHandlers({
  type,
  templateId,
  effectiveTemplateId,
  source,
  sourceSnapshot,
  calculatorQuote,
  paymentPortalMode,
  savedAgreement,
  createMutation,
  saveDraftMutation,
  sendDraftMutation,
  resetSavedBaseline,
  setSavedDraft,
  setConflictMessage,
  onClose,
  conflictMessage,
}: UseAgreementDraftSubmitHandlersInput): {
  handleSaveDraft: (resolved: Step3Resolved) => void
  handleSubmit: (resolved: Step3Resolved) => void
} {
  const shouldSendCalculatorQuote = Boolean(
    calculatorQuote && (!savedAgreement || !savedAgreement.paymentQuoteId),
  )

  const handleSendError = useCallback((error: unknown) => {
    if (isAgreementDraftConflict(error)) {
      setConflictMessage((error as Error).message || conflictMessage)
    }
  }, [conflictMessage, setConflictMessage])

  const sendDraftAgreement = useCallback(
    ({
      agreementId,
      templateId: sendTemplateId,
      resolved,
      expectedUpdatedAt,
    }: {
      agreementId: string
      templateId: string | null
      resolved: Step3Resolved
      expectedUpdatedAt: string
    }) => {
      sendDraftMutation.mutate(
        {
          agreementId,
          payload: buildSendAgreementDraftPayload({
            type,
            templateId: sendTemplateId,
            resolved,
            expectedUpdatedAt,
            paymentPortalMode,
          }),
        },
        {
          onSuccess: onClose,
          onError: handleSendError,
        },
      )
    },
    [handleSendError, onClose, paymentPortalMode, sendDraftMutation, type],
  )

  const handleSaveDraft = useCallback((resolved: Step3Resolved) => {
    const payload = buildSaveAgreementDraftPayload({
      type,
      templateId,
      resolved,
      source,
      sourceSnapshot,
      calculatorQuote: shouldSendCalculatorQuote ? calculatorQuote : undefined,
    })
    saveDraftMutation.mutate(payload, {
      onSuccess: (res) => {
        setSavedDraft(res.data, resolved)
        resetSavedBaseline(payload)
      },
    })
  }, [
    calculatorQuote,
    resetSavedBaseline,
    saveDraftMutation,
    setSavedDraft,
    shouldSendCalculatorQuote,
    source,
    sourceSnapshot,
    templateId,
    type,
  ])

  const handleSubmit = useCallback((resolved: Step3Resolved) => {
    if (!savedAgreement) {
      if (shouldSendCalculatorQuote && calculatorQuote) {
        const draftPayload = buildSaveAgreementDraftPayload({
          type,
          templateId,
          resolved,
          source,
          sourceSnapshot,
          calculatorQuote,
        })
        saveDraftMutation.mutate(draftPayload, {
          onSuccess: (res) => {
            setSavedDraft(res.data, resolved)
            resetSavedBaseline(draftPayload)
            sendDraftAgreement({
              agreementId: res.data.id,
              templateId: res.data.templateId ?? effectiveTemplateId,
              resolved,
              expectedUpdatedAt: res.data.updatedAt,
            })
          },
        })
        return
      }

      createMutation.mutate(buildCreateAgreementPayload({ type, templateId, resolved }), { onSuccess: onClose })
      return
    }

    sendDraftAgreement({
      agreementId: savedAgreement.id,
      templateId: effectiveTemplateId,
      resolved,
      expectedUpdatedAt: savedAgreement.updatedAt,
    })
  }, [
    calculatorQuote,
    createMutation,
    effectiveTemplateId,
    onClose,
    resetSavedBaseline,
    saveDraftMutation,
    savedAgreement,
    sendDraftAgreement,
    setSavedDraft,
    shouldSendCalculatorQuote,
    source,
    sourceSnapshot,
    templateId,
    type,
  ])

  return { handleSaveDraft, handleSubmit }
}
