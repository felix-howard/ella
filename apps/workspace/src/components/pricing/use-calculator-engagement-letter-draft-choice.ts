import { useEffect, useMemo, useState } from 'react'
import type { Agreement } from '../../lib/api-client'
import type { EntityRef } from '../agreements/types'
import { useAgreementsList } from '../agreements/use-agreement-mutations'
import {
  findNewestCalculatorAgreementDraft,
  isCalculatorDraftEntryDecisionPending,
  isCalculatorDraftLookupFailureWithoutDraft,
  shouldResolveCalculatorDraftEntry,
} from './calculator-engagement-letter-modal-helpers'

type CalculatorDraftMode = 'resume' | 'current'

export function useCalculatorEngagementLetterDraftChoice(entity: EntityRef) {
  const agreementsQuery = useAgreementsList(entity, true, 'ENGAGEMENT_LETTER')
  const [draftMode, setDraftMode] = useState<CalculatorDraftMode | null>(null)
  const [entryCalculatorDraft, setEntryCalculatorDraft] =
    useState<Agreement | null | undefined>(undefined)

  const newestCalculatorDraft = useMemo(() => {
    return findNewestCalculatorAgreementDraft(agreementsQuery.data?.data ?? [])
  }, [agreementsQuery.data])

  /* eslint-disable react-hooks/set-state-in-effect -- entry choice is initialized from the first completed draft lookup */
  useEffect(() => {
    if (!shouldResolveCalculatorDraftEntry(
      entryCalculatorDraft,
      agreementsQuery.isLoading,
      agreementsQuery.isError,
      newestCalculatorDraft,
    )) {
      return
    }

    setEntryCalculatorDraft(newestCalculatorDraft)
    if (!newestCalculatorDraft) setDraftMode('current')
  }, [
    agreementsQuery.isError,
    agreementsQuery.isLoading,
    entryCalculatorDraft,
    newestCalculatorDraft,
  ])
  /* eslint-enable react-hooks/set-state-in-effect */

  const draftDecisionPending = isCalculatorDraftEntryDecisionPending(
    entryCalculatorDraft,
    agreementsQuery.isLoading,
    agreementsQuery.isError,
    newestCalculatorDraft,
  )
  const calculatorDraftForChoice = entryCalculatorDraft ?? null
  const activeMode: CalculatorDraftMode =
    calculatorDraftForChoice && draftMode === null ? 'resume' : draftMode ?? 'current'
  const selectedDraft = activeMode === 'resume' ? calculatorDraftForChoice : null

  return {
    isAgreementLookupLoading: agreementsQuery.isLoading,
    refetchAgreements: agreementsQuery.refetch,
    draftDecisionPending,
    lookupFailedWithoutDraft: isCalculatorDraftLookupFailureWithoutDraft(
      entryCalculatorDraft,
      agreementsQuery.isError,
      newestCalculatorDraft,
    ),
    shouldChooseDraftMode: Boolean(calculatorDraftForChoice && draftMode === null),
    calculatorDraftForChoice,
    selectedDraft,
    resumeDraft: () => setDraftMode('resume'),
    startCurrentQuote: () => setDraftMode('current'),
    isStartingCurrentQuote: draftMode === 'current',
  }
}
