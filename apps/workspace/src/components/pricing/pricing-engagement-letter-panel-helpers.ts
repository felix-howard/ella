import type { ComboboxItem } from '@ella/ui'
import type { PricingCalculatorInput, PricingCalculatorResult } from '@ella/shared/pricing'
import type { AgreementPaymentPortalSendMode } from '../../lib/api-client'
import type { RecipientSearchMetadata } from './use-recipient-search'
import {
  buildCalculatorEngagementLetterDraftSeed,
  type CalculatorEngagementLetterDraftSeed,
} from './calculator-engagement-letter-modal-helpers'

export interface SelectedRecipient {
  item: ComboboxItem
  metadata: RecipientSearchMetadata
}

export interface CalculatorEngagementLetterModalState {
  entity: { type: 'client' | 'lead'; id: string }
  recipientLabel: string
  recipientHint?: string
  draftSeed: CalculatorEngagementLetterDraftSeed
}

export function getEngagementLetterDisabledReason(
  pricingDisabledReason: string | null,
  selected: SelectedRecipient | null,
): string | null {
  if (pricingDisabledReason) return pricingDisabledReason
  if (!selected) return 'Select a client or lead to prepare an engagement letter.'
  if (!selected.metadata.hasPhone) {
    return 'Selected recipient has no phone on file. Add a phone number before sending.'
  }
  return null
}

export function createCalculatorEngagementLetterModalState(
  selected: SelectedRecipient,
  pricingInput: PricingCalculatorInput,
  pricingResult: PricingCalculatorResult,
): CalculatorEngagementLetterModalState {
  return {
    entity: {
      type: selected.metadata.type,
      id: selected.metadata.id,
    },
    recipientLabel: selected.metadata.label,
    recipientHint: selected.metadata.hint,
    draftSeed: buildCalculatorEngagementLetterDraftSeed({
      recipient: {
        type: selected.metadata.type,
        id: selected.metadata.id,
      },
      pricingInput,
      pricingResult,
    }),
  }
}

export function getCalculatorPaymentModeLabelKey(
  mode: AgreementPaymentPortalSendMode,
): string {
  return mode === 'AUTO_SEND'
    ? 'settings.calculatorPaymentAutoSend'
    : 'settings.calculatorPaymentStaffReview'
}
