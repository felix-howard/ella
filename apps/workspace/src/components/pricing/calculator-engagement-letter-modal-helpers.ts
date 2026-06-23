import type { CreateAgreementPayload } from '../../lib/api-client'
import {
  emptyStep3Draft,
  type Step3Draft,
  type Step3Resolved,
} from '../agreements/wizard-steps/step3-content-editor'

interface CalculatorEngagementLetterMutation {
  mutate: (
    payload: CreateAgreementPayload,
    options?: { onSuccess?: () => void },
  ) => void
}

export function createCalculatorEngagementLetterDraft(contentHtml: string): Step3Draft {
  return {
    ...emptyStep3Draft,
    titleOverride: 'Engagement Letter',
    htmlOverride: contentHtml,
    depositEnabledOverride: false,
    expiryDays: 30,
  }
}

export function buildCalculatorEngagementLetterPayload(
  resolved: Step3Resolved,
): CreateAgreementPayload {
  return {
    type: 'ENGAGEMENT_LETTER',
    title: resolved.title.trim() || undefined,
    contentHtml: resolved.contentHtml.trim() || undefined,
    depositAmount: resolved.depositEnabled ? resolved.depositAmount : null,
    internalNote: resolved.internalNote.trim() || undefined,
    expiryDays: resolved.expiryDays,
  }
}

export function submitCalculatorEngagementLetter(
  resolved: Step3Resolved,
  mutation: CalculatorEngagementLetterMutation,
  onSuccess: () => void,
): void {
  mutation.mutate(buildCalculatorEngagementLetterPayload(resolved), { onSuccess })
}
