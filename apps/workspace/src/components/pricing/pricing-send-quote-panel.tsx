import { useEffect, useRef, useState } from 'react'
import { Button, Combobox, type ComboboxItem } from '@ella/ui'
import { Copy, Loader2, Send, UserPlus, X } from 'lucide-react'
import type { PricingCalculatorInput } from '@ella/shared/pricing'
import { copyToClipboard } from '../../lib/clipboard'
import { toast } from '../../stores/toast-store'
import { serializePricingInput } from './pricing-format'
import { useRecipientSearch, decodeRecipientId } from './use-recipient-search'
import { useSendQuote } from './use-send-quote'

interface PricingSendQuotePanelProps {
  pricingInput: PricingCalculatorInput
  /** Same guard the link panel uses; non-null disables sending. */
  disabledReason: string | null
}

export function PricingSendQuotePanel({ pricingInput, disabledReason }: PricingSendQuotePanelProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<ComboboxItem | null>(null)
  const [sentSignature, setSentSignature] = useState<string | null>(null)
  const { items, loading } = useRecipientSearch(query)
  const sendQuote = useSendQuote()

  // Focus management: the combobox unmounts when a recipient is picked (replaced
  // by the chip) and remounts on clear, so move focus across that swap to keep
  // keyboard/SR users from landing on <body>.
  const comboboxRef = useRef<HTMLInputElement>(null)
  const clearButtonRef = useRef<HTMLButtonElement>(null)
  const previousSelectedRef = useRef<ComboboxItem | null>(null)
  useEffect(() => {
    const had = previousSelectedRef.current
    if (!had && selected) clearButtonRef.current?.focus()
    else if (had && !selected) comboboxRef.current?.focus()
    previousSelectedRef.current = selected
  }, [selected])

  const result = sendQuote.data
  const currentSignature = serializePricingInput(pricingInput)
  const quoteChangedSinceSend = Boolean(result) && sentSignature !== currentSignature
  const sendDisabled = Boolean(disabledReason) || !selected || sendQuote.isPending
  const errorMessage = sendQuote.error instanceof Error ? sendQuote.error.message : null

  const handleSelect = (item: ComboboxItem) => {
    setSelected(item)
    setQuery('')
    sendQuote.reset()
  }

  const clearSelection = () => {
    setSelected(null)
    setQuery('')
    sendQuote.reset()
  }

  const handleSend = async () => {
    if (!selected) return
    const recipient = decodeRecipientId(selected.id)
    if (!recipient) return
    try {
      const response = await sendQuote.mutateAsync({
        pricingInput,
        recipient,
      })
      setSentSignature(currentSignature)
      if (response.smsSent) {
        toast.success(`Quote sent to ${selected.label}`)
      } else {
        toast.info('Quote saved — SMS not sent. Copy the link to share it.')
      }
    } catch (error) {
      // Read the thrown error directly: sendQuote.error is still stale here
      // (React hasn't re-rendered yet). The inline <span> shows it post-render.
      toast.error(error instanceof Error ? error.message : 'Could not send quote')
    }
  }

  const handleCopy = () => {
    if (!result?.payUrl) return
    void copyToClipboard(result.payUrl, { successMsg: 'Quote link copied' })
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4" aria-labelledby="send-quote-title">
      <header>
        <h2 id="send-quote-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Send className="h-4 w-4 text-primary" />
          Send to client
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Text the quote to an existing client or lead. They pay on the portal.
        </p>
      </header>

      <div className="mt-4 space-y-3">
        {selected ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-primary-light bg-primary-light/30 px-3 py-2">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">{selected.label}</span>
              {selected.hint && (
                <span className="block truncate text-xs text-muted-foreground">{selected.hint}</span>
              )}
            </span>
            <button
              ref={clearButtonRef}
              type="button"
              onClick={clearSelection}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear selected recipient"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div>
            <label htmlFor="send-quote-recipient" className="mb-1 block text-xs font-medium text-foreground">
              Recipient
            </label>
            <Combobox
              ref={comboboxRef}
              id="send-quote-recipient"
              items={items}
              query={query}
              loading={loading}
              onQueryChange={setQuery}
              onSelect={handleSelect}
              placeholder="Search clients or leads…"
              emptyMessage="No clients or leads match"
              aria-label="Search for a client or lead"
            />
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <UserPlus className="h-3 w-3" />
              Search by name or phone.
            </p>
          </div>
        )}

        <Button type="button" className="w-full" onClick={handleSend} disabled={sendDisabled}>
          {sendQuote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {quoteChangedSinceSend ? 'Send updated quote' : 'Send quote'}
        </Button>

        <p className="min-h-5 text-xs text-muted-foreground" role="status" aria-live="polite">
          {disabledReason ?? (quoteChangedSinceSend ? 'Quote changed. Send again to text the new amount.' : '')}
          {errorMessage ? <span className="block text-error">{errorMessage}</span> : null}
        </p>

        {result && (
          <div className="space-y-3 rounded-lg border border-primary-light bg-primary-light/30 p-3">
            <p className="text-xs font-medium text-primary-dark">
              {result.smsSent ? 'Sent — quote ' : 'Saved — quote '}
              {result.quoteId}
            </p>
            {!result.smsSent && (
              <p className="text-xs text-warning">
                {result.smsSkippedReason === 'no_phone'
                  ? 'Recipient has no phone on file. Copy the link to share it manually.'
                  : 'SMS could not be sent. Copy the link to share it manually.'}
              </p>
            )}
            <Button type="button" variant="outline" className="w-full" onClick={handleCopy}>
              <Copy className="h-4 w-4" />
              Copy pay link
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
