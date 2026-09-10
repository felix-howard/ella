import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import {
  calculatePricing,
  createDefaultPricingInput,
  type PricingCalculatorInput,
} from '@ella/shared/pricing'
import { toast } from '../../stores/toast-store'
import {
  api,
  type PricingQuoteDraftCleanupStatus,
  type PricingQuoteDraftDetail,
  type PricingQuoteDraftSummary,
} from '../../lib/api-client'
import { PricingQuoteDraftPanel } from './quote-drafts/pricing-quote-draft-panel'
import { pricingQuoteDraftSignature } from './quote-drafts/pricing-quote-draft-types'
import { usePricingQuoteDraftAutosave } from './quote-drafts/use-pricing-quote-draft-autosave'
import { pricingQuoteDraftKeys } from './quote-drafts/use-pricing-quote-drafts'
import { PricingCalculatorForm } from './pricing-calculator-form'
import { PricingPaymentLinkPanel } from './pricing-payment-link-panel'
import { PricingSendQuotePanel } from './pricing-send-quote-panel'
import { PricingEngagementLetterPanel } from './pricing-engagement-letter-panel'
import { PricingPrintPanel } from './pricing-print-panel'
import { PricingSummaryPanel } from './pricing-summary-panel'
import { CustomLinkBuilder } from './custom-link/custom-link-builder'
import { serializePricingInput } from './pricing-format'
import type { PricingCheckout } from './pricing-calculator-types'
import { getCreateDisabledReason } from './pricing-disabled-reasons'

type BuilderMode = 'calculator' | 'custom'

interface CreateLinkPayload {
  pricingInput: PricingCalculatorInput
  draftId?: string
  draftUpdatedAt?: string
}

export function PricingCalculatorPage() {
  const { orgId } = useAuth()
  return <PricingCalculatorContent key={orgId ?? 'no-organization'} />
}

function PricingCalculatorContent() {
  const { orgId } = useAuth()
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<BuilderMode>('calculator')
  const [input, setInput] = useState<PricingCalculatorInput>(() => createDefaultPricingInput())
  const [checkout, setCheckout] = useState<PricingCheckout>(null)
  const [quoteChanged, setQuoteChanged] = useState(false)
  const [lastCheckoutSignature, setLastCheckoutSignature] = useState<string | null>(null)
  const [activeDraft, setActiveDraft] = useState<
    Pick<PricingQuoteDraftSummary, 'id' | 'name' | 'updatedAt'> | null
  >(null)
  const [savedDraftSignature, setSavedDraftSignature] = useState(() =>
    pricingQuoteDraftSignature(createDefaultPricingInput())
  )
  const [quoteRevision, setQuoteRevision] = useState(0)
  const [draftBusy, setDraftBusy] = useState(false)
  const [sendPending, setSendPending] = useState(false)
  const [finalActionBusy, setFinalActionBusy] = useState(false)
  const result = useMemo(() => calculatePricing(input), [input])
  const currentCheckoutSignature = makeCheckoutSignature(input)
  const currentCheckoutSignatureRef = useRef(currentCheckoutSignature)

  useEffect(() => {
    currentCheckoutSignatureRef.current = currentCheckoutSignature
  }, [currentCheckoutSignature])

  const createLinkMutation = useMutation({
    mutationFn: ({ pricingInput, draftId, draftUpdatedAt }: CreateLinkPayload) =>
      api.billing.createCheckoutSession(
        draftId && draftUpdatedAt
          ? { pricingInput, draftId, draftUpdatedAt }
          : { pricingInput }
      ),
    onSuccess: (response, variables) => {
      const responseSignature = makeCheckoutSignature(variables.pricingInput)
      if (currentCheckoutSignatureRef.current !== responseSignature) {
        setCheckout(null)
        setQuoteChanged(true)
        toast.info('Quote changed. Create a new link before sharing.')
        return
      }
      setCheckout(response)
      setLastCheckoutSignature(responseSignature)
      setQuoteChanged(false)
      toast.success('Payment link created')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Could not create payment link')
    },
  })

  const disabledReason = getCreateDisabledReason(input, result)
  const errorMessage =
    createLinkMutation.error instanceof Error ? createLinkMutation.error.message : null

  const handleInputChange = (nextInput: PricingCalculatorInput) => {
    if (
      checkout &&
      lastCheckoutSignature &&
      makeCheckoutSignature(nextInput) !== lastCheckoutSignature
    ) {
      setCheckout(null)
      setQuoteChanged(true)
    }
    setInput(nextInput)
  }

  const replaceInput = (nextInput: PricingCalculatorInput) => {
    setInput(nextInput)
    setCheckout(null)
    setLastCheckoutSignature(null)
    setQuoteChanged(false)
    createLinkMutation.reset()
    // Reset child-owned field text, recipient selection, and send results even
    // when the incoming draft happens to contain the same calculator values.
    setQuoteRevision((revision) => revision + 1)
  }

  const handleAutosaveSaved = useCallback((draft: PricingQuoteDraftDetail) => {
    setActiveDraft((current) =>
      current?.id === draft.id
        ? { id: draft.id, name: draft.name, updatedAt: draft.updatedAt }
        : current
    )
    setSavedDraftSignature(pricingQuoteDraftSignature(draft.pricingInput))
  }, [])

  const autosave = usePricingQuoteDraftAutosave({
    draftId: activeDraft?.id ?? null,
    pricingInput: input,
    updatedAt: activeDraft?.updatedAt ?? null,
    enabled: Boolean(activeDraft),
    onSaved: handleAutosaveSaved,
    onConflict: useCallback(() => {
      toast.error('This draft changed elsewhere. Reload it before continuing.')
    }, []),
  })

  const loadDraft = (draft: PricingQuoteDraftDetail) => {
    replaceInput(draft.pricingInput)
    setActiveDraft({ id: draft.id, name: draft.name, updatedAt: draft.updatedAt })
    setSavedDraftSignature(pricingQuoteDraftSignature(draft.pricingInput))
    autosave.resetSavedBaseline(draft.pricingInput)
  }

  const completeDraftFinalAction = async (
    draftId: string,
    draftUpdatedAt: string,
    draftConsumed?: boolean,
    cleanupStatus?: PricingQuoteDraftCleanupStatus
  ) => {
    if (cleanupStatus === 'version_conflict') {
      toast.info('Payment action succeeded. A newer version of this draft was kept.')
    } else if (draftConsumed === false) {
      try {
        await api.billing.deletePricingQuoteDraft(draftId, draftUpdatedAt)
      } catch {
        toast.info('Payment action succeeded, but the completed draft could not be removed.')
      }
    }
    autosave.pause()
    autosave.resetSavedBaseline(null)
    setActiveDraft((current) => (current?.id === draftId ? null : current))
    setSavedDraftSignature(pricingQuoteDraftSignature(createDefaultPricingInput()))
    await queryClient.invalidateQueries({ queryKey: pricingQuoteDraftKeys.list(orgId) })
  }

  const prepareFinalAction = async (): Promise<string | undefined> => {
    if (!activeDraft) return undefined
    autosave.pause()
    try {
      return await autosave.saveNow()
    } catch (error) {
      autosave.resume()
      throw error
    }
  }

  const handleCreate = async () => {
    const draftId = activeDraft?.id
    setFinalActionBusy(true)
    let finalRequestStarted = false
    try {
      const draftUpdatedAt = await prepareFinalAction()
      finalRequestStarted = true
      const response = await createLinkMutation.mutateAsync({
        pricingInput: input,
        draftId,
        draftUpdatedAt,
      })
      if (draftId && draftUpdatedAt) {
        await completeDraftFinalAction(
          draftId,
          draftUpdatedAt,
          response.draftConsumed,
          response.draftCleanupStatus
        )
      }
    } catch (error) {
      if (draftId) autosave.resume()
      if (!finalRequestStarted) {
        toast.error(error instanceof Error ? error.message : 'Could not save quote draft')
      }
      throw error
    } finally {
      setFinalActionBusy(false)
    }
  }

  const reloadActiveDraft = async () => {
    if (!activeDraft) return
    setFinalActionBusy(true)
    try {
      const draft = await api.billing.getPricingQuoteDraft(activeDraft.id)
      loadDraft(draft)
      toast.success(`${draft.name} reloaded`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not reload quote draft')
    } finally {
      setFinalActionBusy(false)
    }
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Pricing Calculator</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Build a workspace quote and create a Stripe Checkout link without a pasted token.
        </p>
      </header>

      <ModeSwitch
        mode={mode}
        onChange={setMode}
        disabled={draftBusy || sendPending || finalActionBusy || createLinkMutation.isPending}
      />

      {mode === 'calculator' ? (
        <>
          <PricingQuoteDraftPanel
            input={input}
            activeDraft={activeDraft}
            hasUnsavedChanges={pricingQuoteDraftSignature(input) !== savedDraftSignature}
            autosaveState={autosave.state}
            managementDisabled={autosave.state === 'unsaved' || autosave.state === 'saving'}
            disabled={
              createLinkMutation.isPending ||
              sendPending ||
              finalActionBusy ||
              autosave.state === 'saving'
            }
            onBusyChange={setDraftBusy}
            onSaved={(draft, savedInput) => {
              setActiveDraft({ id: draft.id, name: draft.name, updatedAt: draft.updatedAt })
              setSavedDraftSignature(pricingQuoteDraftSignature(savedInput))
              autosave.resetSavedBaseline(savedInput)
            }}
            onLoad={loadDraft}
            onRenamed={(draft) => {
              if (activeDraft?.id === draft.id) {
                setActiveDraft({ id: draft.id, name: draft.name, updatedAt: draft.updatedAt })
              }
            }}
            onDeleted={(id) => {
              if (activeDraft?.id !== id) return
              setActiveDraft(null)
              setSavedDraftSignature(pricingQuoteDraftSignature(createDefaultPricingInput()))
              autosave.resetSavedBaseline(null)
            }}
            onNewQuote={() => {
              const defaults = createDefaultPricingInput()
              replaceInput(defaults)
              setActiveDraft(null)
              setSavedDraftSignature(pricingQuoteDraftSignature(defaults))
              autosave.resetSavedBaseline(null)
            }}
            onRetryAutosave={() => {
              void autosave.saveNow().catch(() => undefined)
            }}
            onReloadActiveDraft={() => {
              void reloadActiveDraft()
            }}
          />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
            <PricingCalculatorForm
              key={quoteRevision}
              input={input}
              disabled={
                createLinkMutation.isPending || draftBusy || sendPending || finalActionBusy
              }
              onInputChange={handleInputChange}
            />
            <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
              <PricingSummaryPanel result={result} />
              <PricingEngagementLetterPanel
                pricingInput={input}
                pricingResult={result}
                disabledReason={disabledReason}
              />
              <PricingPaymentLinkPanel
                checkout={checkout}
                disabledReason={draftBusy || finalActionBusy ? 'Wait for the draft operation to finish.' : disabledReason}
                errorMessage={errorMessage}
                isCreating={createLinkMutation.isPending}
                quoteChanged={quoteChanged}
                onCreate={handleCreate}
              />
              <PricingSendQuotePanel
                key={quoteRevision}
                pricingInput={input}
                draftId={activeDraft?.id}
                disabledReason={draftBusy || finalActionBusy ? 'Wait for the draft operation to finish.' : disabledReason}
                beforeSend={prepareFinalAction}
                onSendSuccess={async (response, draftUpdatedAt) => {
                  if (activeDraft && draftUpdatedAt) {
                    await completeDraftFinalAction(
                      activeDraft.id,
                      draftUpdatedAt,
                      response.draftConsumed,
                      response.draftCleanupStatus
                    )
                  }
                }}
                onSendFailure={() => {
                  if (activeDraft) autosave.resume()
                }}
                onPendingChange={setSendPending}
              />
              <PricingPrintPanel input={input} result={result} />
            </aside>
          </div>
        </>
      ) : (
        <CustomLinkBuilder />
      )}
    </section>
  )
}

function ModeSwitch({ mode, onChange, disabled }: {
  mode: BuilderMode
  onChange: (mode: BuilderMode) => void
  disabled: boolean
}) {
  const tabs: Array<{ value: BuilderMode; label: string }> = [
    { value: 'calculator', label: 'Calculator' },
    { value: 'custom', label: 'Custom link' },
  ]
  return (
    <div
      role="tablist"
      aria-label="Payment link source"
      className="inline-flex rounded-lg border border-border bg-card p-1"
    >
      {tabs.map((tab) => {
        const active = mode === tab.value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(tab.value)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

function makeCheckoutSignature(input: PricingCalculatorInput): string {
  return JSON.stringify({
    pricingInput: JSON.parse(serializePricingInput(input)) as PricingCalculatorInput,
  })
}
