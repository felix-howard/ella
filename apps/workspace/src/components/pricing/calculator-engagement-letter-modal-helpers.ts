import type {
  PricingCalculatorInput,
  PricingCalculatorResult,
} from '@ella/shared/pricing'
import type { Agreement, AgreementSource, AgreementType } from '../../lib/api-client'
import {
  emptyStep3Draft,
  type Step3Draft,
} from '../agreements/wizard-steps/step3-content-editor'
import { buildCalculatorEngagementLetterHtml } from './engagement-letter-content-builder'

interface CalculatorDraftRecipient {
  id: string
  type: 'client' | 'lead'
}

interface CalculatorEngagementLetterDraftSeedInput {
  recipient: CalculatorDraftRecipient
  pricingInput: PricingCalculatorInput
  pricingResult: PricingCalculatorResult
  preparedAt?: Date
}

export interface CalculatorEngagementLetterDraftSeed {
  type: Extract<AgreementType, 'ENGAGEMENT_LETTER'>
  title: string
  contentHtml: string
  source: Extract<AgreementSource, 'CALCULATOR'>
  sourceSnapshot: {
    preparedAt: string
    recipient: CalculatorDraftRecipient
    setupTotal: number
    monthlyTotal: number
    tierLabel: string
  }
  draft: Step3Draft
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

export function buildCalculatorEngagementLetterDraftSeed({
  recipient,
  pricingInput,
  pricingResult,
  preparedAt = new Date(),
}: CalculatorEngagementLetterDraftSeedInput): CalculatorEngagementLetterDraftSeed {
  const contentHtml = buildCalculatorEngagementLetterHtml({
    pricingInput,
    pricingResult,
    preparedAt,
  })

  return {
    type: 'ENGAGEMENT_LETTER',
    title: 'Engagement Letter',
    contentHtml,
    source: 'CALCULATOR',
    sourceSnapshot: {
      preparedAt: preparedAt.toISOString(),
      recipient,
      setupTotal: pricingResult.setupDisplayTotal,
      monthlyTotal: pricingResult.monthlyTotal,
      tierLabel: pricingResult.tierLabel,
    },
    draft: createCalculatorEngagementLetterDraft(contentHtml),
  }
}

export function findNewestCalculatorAgreementDraft(
  agreements: Agreement[],
): Agreement | null {
  return agreements
    .filter((agreement) =>
      agreement.status === 'DRAFT' && agreement.source === 'CALCULATOR'
    )
    .sort((left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    )[0] ?? null
}

export function getCalculatorDraftEditorSourceSnapshot(
  selectedDraft: Agreement | null,
  draftSeed: CalculatorEngagementLetterDraftSeed,
): Record<string, unknown> | undefined {
  if (selectedDraft) return selectedDraft.sourceSnapshot ?? undefined
  return draftSeed.sourceSnapshot
}

export function shouldResolveCalculatorDraftEntry(
  entryDraft: Agreement | null | undefined,
  isLoading: boolean,
  isError: boolean,
  newestDraft: Agreement | null,
): boolean {
  if (entryDraft !== undefined || isLoading) return false
  return !isError || Boolean(newestDraft)
}

export function isCalculatorDraftEntryDecisionPending(
  entryDraft: Agreement | null | undefined,
  isLoading: boolean,
  isError: boolean,
  newestDraft: Agreement | null,
): boolean {
  return entryDraft === undefined && !isLoading && (!isError || Boolean(newestDraft))
}

export function isCalculatorDraftLookupFailureWithoutDraft(
  entryDraft: Agreement | null | undefined,
  isError: boolean,
  newestDraft: Agreement | null,
): boolean {
  return isError && entryDraft === undefined && !newestDraft
}
