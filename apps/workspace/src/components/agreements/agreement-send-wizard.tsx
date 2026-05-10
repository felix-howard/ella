/**
 * 3-step wizard for sending an agreement (NDA / Engagement Letter / Service
 * Agreement / Custom). Steps:
 *   1. Type picker — 4 cards
 *   2. Template picker — list filtered by type, "Start Blank" option.
 *      For NDA, a synthetic "Default NDA" card surfaces the built-in template
 *      so the picker step is consistent across types.
 *   3. Content editor — rich text + title + deposit toggle + link expiry
 *
 * On submit the wizard POSTs to the entity-aware /agreements endpoint via
 * useCreateAgreement, then closes itself on success (toast + cache invalidation
 * are handled by the mutation hook).
 *
 * State machine is a simple { step, type?, templateId? | 'blank' | 'builtin',
 * html, title, depositEnabled, depositAmount, expiryDays }. Back button steps
 * backward without losing already-entered fields.
 */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Loader2, X } from 'lucide-react'
import { useCreateAgreement } from './use-agreement-mutations'
import { useNdaReadiness } from './use-nda-readiness'
import { NdaSetupRequiredCard } from './nda-setup-required-card'
import { Step1TypePicker } from './wizard-steps/step1-type-picker'
import { Step2TemplatePicker } from './wizard-steps/step2-template-picker'
import {
  Step3ContentEditor,
  emptyStep3Draft,
  type Step3Draft,
} from './wizard-steps/step3-content-editor'
import {
  BLANK_TEMPLATE,
  BUILTIN_ENGAGEMENT_LETTER_TEMPLATE,
  BUILTIN_NDA_TEMPLATE,
} from './wizard-steps/template-sentinels'
import { formatPhone } from '../../lib/formatters'
import type {
  Agreement,
  AgreementType,
  CreateAgreementPayload,
} from '../../lib/api-client'
import type { EntityRef, Recipient } from './types'

interface Props {
  entity: EntityRef
  recipient: Recipient
  /** Existing agreements for this entity — used by Step 1 to surface the
   *  NDA-only active-engagement gate (other types always sendable). */
  agreements: Agreement[]
  onClose: () => void
}

type Step = 1 | 2 | 3

export function AgreementSendWizard({ entity, recipient, agreements, onClose }: Props) {
  const { t } = useTranslation()
  const mutation = useCreateAgreement(entity)

  const [step, setStep] = useState<Step>(1)
  const [type, setType] = useState<AgreementType | null>(null)
  // null = unselected; BLANK_TEMPLATE = empty editor; else template id.
  const [templateId, setTemplateId] = useState<string | null>(null)
  // Step3 draft is owned here so Back navigation preserves user input.
  const [draft, setDraft] = useState<Step3Draft>(emptyStep3Draft)

  // Agreement setup pre-flight: block send when CPA / org missing required setup.
  // Fail closed — if the query errors (offline, 401, 500), keep the user gated.
  // Server-side `snapshotFirmSide` is the real enforcement; this is just UX.
  const readinessType = type === 'ENGAGEMENT_LETTER' ? 'ENGAGEMENT_LETTER' : 'NDA'
  const needsReadiness = type === 'NDA' || type === 'ENGAGEMENT_LETTER'
  const readinessQuery = useNdaReadiness(readinessType, needsReadiness)
  const setupMissing =
    needsReadiness &&
    (readinessQuery.isError ||
      (readinessQuery.data ? !readinessQuery.data.ready : false))

  // Esc closes the wizard unless a submit is in flight.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !mutation.isPending) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mutation.isPending, onClose])

  const handleTypeSelect = (next: AgreementType) => {
    setType(next)
    if (next === 'CUSTOM') {
      // CUSTOM rejects templateId server-side; force blank editor.
      setTemplateId(BLANK_TEMPLATE)
      setStep(3)
      return
    }
    setTemplateId(null)
    setStep(2)
  }

  const handleTemplateSelect = (id: string | null) => {
    // null from picker means "Start Blank".
    setTemplateId(id ?? BLANK_TEMPLATE)
    setStep(3)
  }

  const handleBack = () => {
    if (step === 3) {
      // CUSTOM skipped Step 2 — bounce back to Step 1.
      const target: Step = type === 'CUSTOM' ? 1 : 2
      setStep(target)
      return
    }
    if (step === 2) {
      setStep(1)
      return
    }
  }

  const handleSubmit = (resolved: {
    title: string
    contentHtml: string
    depositEnabled: boolean
    depositAmount: string
    internalNote: string
    expiryDays: number
  }) => {
    if (!type) return
    // BLANK + BUILTIN_NDA are client-only sentinels — never sent to the server.
    // Server resolves NDA without templateId/contentHtml to the built-in default,
    // and the editor always supplies contentHtml so the snapshot is exact.
    const isRealTemplate =
      !!templateId &&
      templateId !== BLANK_TEMPLATE &&
      templateId !== BUILTIN_NDA_TEMPLATE &&
      templateId !== BUILTIN_ENGAGEMENT_LETTER_TEMPLATE
    const payload: CreateAgreementPayload = {
      type,
      title: resolved.title.trim() || undefined,
      contentHtml: resolved.contentHtml.trim() || undefined,
      templateId: isRealTemplate ? templateId : undefined,
      depositAmount: resolved.depositEnabled ? resolved.depositAmount : null,
      internalNote: resolved.internalNote.trim() || undefined,
      expiryDays: resolved.expiryDays,
    }
    mutation.mutate(payload, { onSuccess: () => onClose() })
  }

  const fullName = useMemo(
    () => [recipient.firstName, recipient.lastName].filter(Boolean).join(' '),
    [recipient],
  )

  const titleKey: Record<Step, string> = {
    1: 'agreements.wizard.step1Title',
    2: 'agreements.wizard.step2Title',
    3: 'agreements.wizard.step3Title',
  }

  const showBack = step !== 1

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/50 z-[10000]"
        onClick={() => !mutation.isPending && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="agreement-wizard-title"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[10001] w-[calc(100vw-2rem)] max-w-6xl max-h-[92vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            {showBack && (
              <button
                type="button"
                onClick={handleBack}
                disabled={mutation.isPending}
                aria-label={t('common.back')}
                className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="min-w-0">
              <h3 id="agreement-wizard-title" className="text-lg font-semibold text-foreground">
                {t(titleKey[step])}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                {fullName} · {formatPhone(recipient.phone)} ·{' '}
                {t('agreements.wizard.stepIndicator', { current: step, total: 3 })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            aria-label={t('common.close')}
            className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <Step1TypePicker agreements={agreements} onSelect={handleTypeSelect} />
          )}
          {step === 2 && type && (
            <Step2TemplatePicker type={type} onSelect={handleTemplateSelect} />
          )}
          {step === 3 && needsReadiness && readinessQuery.isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {step === 3 && needsReadiness && !readinessQuery.isLoading && setupMissing && (
            <NdaSetupRequiredCard
              missing={readinessQuery.data?.missing ?? []}
              isRefreshing={readinessQuery.isFetching}
              hasError={readinessQuery.isError}
              onClose={onClose}
            />
          )}
          {step === 3 && type && !(needsReadiness && (readinessQuery.isLoading || setupMissing)) && (
            <Step3ContentEditor
              entity={entity}
              type={type}
              templateId={templateId}
              isSubmitting={mutation.isPending}
              draft={draft}
              onDraftChange={setDraft}
              onCancel={onClose}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}
