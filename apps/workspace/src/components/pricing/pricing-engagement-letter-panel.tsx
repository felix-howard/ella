import { useEffect, useRef, useState } from 'react'
import { Button, Combobox, type ComboboxItem } from '@ella/ui'
import { useQuery } from '@tanstack/react-query'
import { FileText, UserPlus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PricingCalculatorInput, PricingCalculatorResult } from '@ella/shared/pricing'
import { api } from '../../lib/api-client'
import { CalculatorEngagementLetterModal } from './calculator-engagement-letter-modal'
import {
  decodeRecipientId,
  type RecipientSearchMetadata,
  useRecipientSearch,
} from './use-recipient-search'
import {
  createCalculatorEngagementLetterModalState,
  getCalculatorPaymentModeLabelKey,
  getEngagementLetterDisabledReason,
  type CalculatorEngagementLetterModalState,
  type SelectedRecipient,
} from './pricing-engagement-letter-panel-helpers'

interface PricingEngagementLetterPanelProps {
  pricingInput: PricingCalculatorInput
  pricingResult: PricingCalculatorResult
  disabledReason: string | null
}

export function PricingEngagementLetterPanel({
  pricingInput,
  pricingResult,
  disabledReason,
}: PricingEngagementLetterPanelProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<SelectedRecipient | null>(null)
  const [modal, setModal] = useState<CalculatorEngagementLetterModalState | null>(null)
  const { items, recipientByItemId, loading } = useRecipientSearch(query)
  const orgSettingsQuery = useQuery({
    queryKey: ['org-settings'],
    queryFn: () => api.orgSettings.get(),
  })

  const comboboxRef = useRef<HTMLInputElement>(null)
  const clearButtonRef = useRef<HTMLButtonElement>(null)
  const previousSelectedRef = useRef<SelectedRecipient | null>(null)

  useEffect(() => {
    const previous = previousSelectedRef.current
    if (!previous && selected) clearButtonRef.current?.focus()
    else if (previous && !selected) comboboxRef.current?.focus()
    previousSelectedRef.current = selected
  }, [selected])

  const actionDisabledReason = getEngagementLetterDisabledReason(disabledReason, selected)
  const defaultPaymentMode =
    orgSettingsQuery.data?.calculatorAgreementPaymentMode ?? 'STAFF_REVIEW'

  const handleSelect = (item: ComboboxItem) => {
    const metadata = recipientByItemId.get(item.id)
    const fallback = decodeRecipientId(item.id)
    if (!metadata && !fallback) return
    setSelected({
      item,
      metadata: metadata ?? ({
        id: fallback!.id,
        type: fallback!.type,
        label: item.label,
        hint: item.hint,
        hasPhone: Boolean(item.hint?.includes('••••')),
      } satisfies RecipientSearchMetadata),
    })
    setQuery('')
  }

  const clearSelection = () => {
    setSelected(null)
    setQuery('')
  }

  const openModal = () => {
    if (!selected || actionDisabledReason) return
    setModal(createCalculatorEngagementLetterModalState(selected, pricingInput, pricingResult))
  }

  return (
    <section
      className="rounded-lg border border-border bg-card p-4"
      aria-labelledby="engagement-letter-panel-title">
      <header>
        <h2 id="engagement-letter-panel-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <FileText className="h-4 w-4 text-primary" />
          Engagement letter
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Prepare editable agreement text from the current calculator fees.
        </p>
      </header>

      <div className="mt-4 space-y-3">
        {selected ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-primary-light bg-primary-light/30 px-3 py-2">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">
                {selected.item.label}
              </span>
              {selected.item.hint && (
                <span className="block truncate text-xs text-muted-foreground">
                  {selected.item.hint}
                </span>
              )}
            </span>
            <button
              ref={clearButtonRef}
              type="button"
              onClick={clearSelection}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear selected engagement letter recipient"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div>
            <label htmlFor="engagement-letter-recipient" className="mb-1 block text-xs font-medium text-foreground">
              Recipient
            </label>
            <Combobox
              ref={comboboxRef}
              id="engagement-letter-recipient"
              items={items}
              query={query}
              loading={loading}
              onQueryChange={setQuery}
              onSelect={handleSelect}
              placeholder="Search clients or leads..."
              emptyMessage="No clients or leads match"
              aria-label="Search for an engagement letter recipient"
            />
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <UserPlus className="h-3 w-3" />
              Search by name or phone.
            </p>
          </div>
        )}

        <Button
          type="button"
          className="w-full"
          onClick={openModal}
          disabled={Boolean(actionDisabledReason)}
        >
          <FileText className="h-4 w-4" />
          Prepare engagement letter
        </Button>

        <p className="min-h-5 text-xs text-muted-foreground" role="status" aria-live="polite">
          {actionDisabledReason ?? 'Review and edit before previewing the PDF.'}
        </p>
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {t('pricing.engagementLetterDraft.paymentModeDefaultLabel', {
            mode: t(getCalculatorPaymentModeLabelKey(defaultPaymentMode)),
          })}
        </p>
      </div>

      {modal && (
        <CalculatorEngagementLetterModal
          entity={modal.entity}
          recipientLabel={modal.recipientLabel}
          recipientHint={modal.recipientHint}
          draftSeed={modal.draftSeed}
          onClose={() => setModal(null)}
        />
      )}
    </section>
  )
}
