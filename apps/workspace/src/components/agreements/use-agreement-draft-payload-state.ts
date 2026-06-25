import { useMemo } from 'react'
import type {
  Agreement,
  AgreementSource,
  AgreementType,
  SaveAgreementDraftPayload,
} from '../../lib/api-client'
import { buildSaveAgreementDraftPayload } from './agreement-draft-payload'
import type {
  Step3Draft,
  Step3Resolved,
} from './wizard-steps/step3-content-editor'

interface UseAgreementDraftPayloadStateInput {
  draft: Step3Draft
  savedAgreement: Agreement | null
  savedResolved: Step3Resolved | null
  fallbackTitle: string
  type: AgreementType
  templateId: string | null
  source: AgreementSource
  sourceSnapshot?: Record<string, unknown>
}

interface UseAgreementDraftPayloadStateResult {
  effectiveTemplateId: string | null
  autosaveResolved: Step3Resolved | null
  autosavePayload: SaveAgreementDraftPayload | null
}

function mergeResolvedFromDraft(
  draft: Step3Draft,
  savedResolved: Step3Resolved,
  fallbackTitle: string,
): Step3Resolved {
  return {
    title: draft.titleOverride ?? savedResolved.title ?? fallbackTitle,
    contentHtml: draft.htmlOverride ?? savedResolved.contentHtml,
    depositEnabled: draft.depositEnabledOverride ?? savedResolved.depositEnabled,
    depositAmount: draft.depositAmountOverride ?? savedResolved.depositAmount,
    internalNote: draft.internalNote,
    expiryDays: draft.expiryDays,
  }
}

export function useAgreementDraftPayloadState({
  draft,
  savedAgreement,
  savedResolved,
  fallbackTitle,
  type,
  templateId,
  source,
  sourceSnapshot,
}: UseAgreementDraftPayloadStateInput): UseAgreementDraftPayloadStateResult {
  const effectiveTemplateId = savedAgreement?.templateId ?? templateId
  const autosaveResolved = useMemo(
    () => (savedResolved ? mergeResolvedFromDraft(draft, savedResolved, fallbackTitle) : null),
    [draft, fallbackTitle, savedResolved],
  )
  const autosavePayload: SaveAgreementDraftPayload | null = useMemo(
    () =>
      autosaveResolved
        ? buildSaveAgreementDraftPayload({
            type,
            templateId: effectiveTemplateId,
            resolved: autosaveResolved,
            source,
            sourceSnapshot,
          })
        : null,
    [autosaveResolved, effectiveTemplateId, source, sourceSnapshot, type],
  )

  return { effectiveTemplateId, autosaveResolved, autosavePayload }
}
