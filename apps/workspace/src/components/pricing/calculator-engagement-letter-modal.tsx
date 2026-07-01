import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AgreementDraftEditor } from '../agreements/agreement-draft-editor'
import { CalculatorPaymentModeControl } from '../agreements/calculator-payment-mode-control'
import { useNdaReadiness } from '../agreements/use-nda-readiness'
import { NdaSetupRequiredCard } from '../agreements/nda-setup-required-card'
import type { EntityRef } from '../agreements/types'
import { api, type AgreementPaymentPortalSendMode } from '../../lib/api-client'
import { CalculatorEngagementLetterDraftChoice } from './calculator-engagement-letter-draft-choice'
import {
  getCalculatorDraftEditorSourceSnapshot,
  getCalculatorSourceSnapshotPaymentPortalMode,
  resolveCalculatorPaymentPortalMode,
  type CalculatorEngagementLetterDraftSeed,
} from './calculator-engagement-letter-modal-helpers'
import { useCalculatorEngagementLetterDraftChoice } from './use-calculator-engagement-letter-draft-choice'

interface CalculatorEngagementLetterModalProps {
  entity: EntityRef
  recipientLabel: string
  recipientHint?: string
  draftSeed: CalculatorEngagementLetterDraftSeed
  onClose: () => void
}

export function CalculatorEngagementLetterModal({
  entity,
  recipientLabel,
  recipientHint,
  draftSeed,
  onClose,
}: CalculatorEngagementLetterModalProps) {
  const { t, i18n } = useTranslation()
  const readinessQuery = useNdaReadiness('ENGAGEMENT_LETTER')
  const orgSettingsQuery = useQuery({
    queryKey: ['org-settings'],
    queryFn: () => api.orgSettings.get(),
  })
  const [paymentPortalModeOverride, setPaymentPortalModeOverride] =
    useState<AgreementPaymentPortalSendMode | null>(null)
  const closeGuardRef = useRef<(() => boolean) | null>(null)
  const draftChoice = useCalculatorEngagementLetterDraftChoice(entity)
  const selectedDraft = draftChoice.selectedDraft

  const setupMissing =
    readinessQuery.isError || (readinessQuery.data ? !readinessQuery.data.ready : false)
  const orgDefaultPaymentMode =
    orgSettingsQuery.data?.calculatorAgreementPaymentMode ?? 'STAFF_REVIEW'
  const selectedDraftPaymentMode = selectedDraft
    ? resolveCalculatorPaymentPortalMode(
        selectedDraft.paymentPortalMode,
        getCalculatorSourceSnapshotPaymentPortalMode(selectedDraft.sourceSnapshot) ??
          orgDefaultPaymentMode,
      )
    : null
  const paymentPortalMode =
    paymentPortalModeOverride ?? selectedDraftPaymentMode ?? orgDefaultPaymentMode
  const canContinuePastLookupFailure =
    !draftChoice.lookupFailedWithoutDraft || draftChoice.isStartingCurrentQuote
  const hasResolvedEditorState =
    !readinessQuery.isLoading &&
    !draftChoice.isAgreementLookupLoading &&
    !draftChoice.draftDecisionPending
  const isWaitingForPaymentSettings =
    !selectedDraft &&
    !draftChoice.shouldChooseDraftMode &&
    canContinuePastLookupFailure &&
    orgSettingsQuery.isLoading
  const showLoadingState = !hasResolvedEditorState || isWaitingForPaymentSettings
  const showSetupRequired = hasResolvedEditorState && setupMissing
  const showLookupFailure =
    hasResolvedEditorState &&
    !setupMissing &&
    draftChoice.lookupFailedWithoutDraft &&
    !draftChoice.isStartingCurrentQuote
  const showDraftChoice =
    hasResolvedEditorState &&
    !setupMissing &&
    draftChoice.shouldChooseDraftMode &&
    Boolean(draftChoice.calculatorDraftForChoice)
  const canShowEditor =
    hasResolvedEditorState &&
    !setupMissing &&
    canContinuePastLookupFailure &&
    !draftChoice.shouldChooseDraftMode &&
    !isWaitingForPaymentSettings

  const registerCloseGuard = useCallback((guard: (() => boolean) | null) => {
    closeGuardRef.current = guard
  }, [])

  const requestClose = useCallback(() => {
    if (closeGuardRef.current && !closeGuardRef.current()) return
    onClose()
  }, [onClose])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [requestClose])

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[10000] bg-black/50"
        onClick={requestClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="calculator-engagement-letter-title"
        className="fixed left-1/2 top-1/2 z-[10001] flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3
                  id="calculator-engagement-letter-title"
                  className="text-lg font-semibold text-foreground"
                >
                  {t('agreements.wizard.step3Title')}
                </h3>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {recipientLabel}
                  {recipientHint ? ` · ${recipientHint}` : ''} ·{' '}
                  {t('pricing.engagementLetterDraft.calculatorDraft')}
                </p>
              </div>
              <button
                type="button"
                onClick={requestClose}
                aria-label={t('common.close')}
                className="rounded-md p-1.5 transition-colors hover:bg-muted disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {canShowEditor && (
              <div className="mt-4 rounded-xl border border-border bg-background/60 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {t('settings.calculatorPaymentAfterSignature')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedDraft
                        ? t('pricing.engagementLetterDraft.paymentModeSavedDraftHint')
                        : t('pricing.engagementLetterDraft.paymentModeCurrentQuoteHint')}
                    </p>
                  </div>
                  {orgSettingsQuery.isError && !selectedDraft && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                      {t('pricing.engagementLetterDraft.paymentModeSafeFallback')}
                    </span>
                  )}
                </div>
                <CalculatorPaymentModeControl
                  value={paymentPortalMode}
                  name="calculator-letter-payment-mode"
                  compact
                  onChange={setPaymentPortalModeOverride}
                  t={t}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {showLoadingState && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {showSetupRequired && (
            <NdaSetupRequiredCard
              missing={readinessQuery.data?.missing ?? []}
              isRefreshing={readinessQuery.isFetching}
              hasError={readinessQuery.isError}
              onClose={requestClose}
            />
          )}
          {showLookupFailure && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-foreground">
                {t('pricing.engagementLetterDraft.lookupFailed')}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => draftChoice.refetchAgreements()}
                  className="rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
                >
                  {t('common.retry')}
                </button>
                <button
                  type="button"
                  onClick={draftChoice.startCurrentQuote}
                  className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {t('pricing.engagementLetterDraft.startCurrent')}
                </button>
              </div>
            </div>
          )}
          {showDraftChoice && draftChoice.calculatorDraftForChoice && (
            <CalculatorEngagementLetterDraftChoice
              draft={draftChoice.calculatorDraftForChoice}
              language={i18n.language}
              onResume={draftChoice.resumeDraft}
              onStartCurrent={draftChoice.startCurrentQuote}
              onCancel={requestClose}
              t={t}
            />
          )}
          {canShowEditor && (
            <AgreementDraftEditor
              entity={entity}
              key={selectedDraft?.id ?? draftSeed.contentHtml}
              type={selectedDraft?.type ?? draftSeed.type}
              templateId={selectedDraft?.templateId ?? null}
              source={selectedDraft?.source ?? draftSeed.source}
              sourceSnapshot={getCalculatorDraftEditorSourceSnapshot(
                selectedDraft,
                draftSeed,
                paymentPortalMode,
              )}
              {...(selectedDraft
                ? {}
                : {
                    calculatorQuote: {
                      ...draftSeed.calculatorQuote,
                      paymentPortalMode,
                    },
                  })}
              paymentPortalMode={paymentPortalMode}
              initialDraft={selectedDraft ? undefined : draftSeed.draft}
              closeBaselineDraft={selectedDraft ? undefined : draftSeed.draft}
              existingDraft={selectedDraft ?? undefined}
              onClose={onClose}
              registerCloseGuard={registerCloseGuard}
            />
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}
