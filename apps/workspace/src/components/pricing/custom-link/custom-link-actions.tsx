import { useState } from 'react'
import { Button, Combobox, type ComboboxItem } from '@ella/ui'
import { Link2, Loader2, Send, X } from 'lucide-react'
import type { CreateCustomCheckoutInput } from '../../../lib/api-client'
import { toast } from '../../../stores/toast-store'
import { useRecipientSearch, decodeRecipientId } from '../use-recipient-search'
import { CustomLinkCreateResult, CustomLinkSendResult } from './custom-link-result'
import { useCreateCustomLink, useSendCustomQuote } from './use-custom-link'
import type { CustomLinkCorePayload } from './custom-link-types'

interface CustomLinkActionsProps {
  /** Items + interval + discount, or null when the items are incomplete. */
  corePayload: CustomLinkCorePayload | null
  /** Non-null disables both actions (e.g. "Add at least one valid item"). */
  disabledReason: string | null
}

export function CustomLinkActions({ corePayload, disabledReason }: CustomLinkActionsProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<ComboboxItem | null>(null)
  const { items, loading } = useRecipientSearch(query)
  const createLink = useCreateCustomLink()
  const sendQuote = useSendCustomQuote()

  const buildPayload = (): CreateCustomCheckoutInput | null =>
    corePayload ? { ...corePayload } : null

  const blocked = Boolean(disabledReason) || !corePayload
  const createDisabled = blocked || createLink.isPending
  const sendDisabled = blocked || !selected || sendQuote.isPending
  const errorMessage =
    (createLink.error instanceof Error ? createLink.error.message : null) ??
    (sendQuote.error instanceof Error ? sendQuote.error.message : null)

  const handleCreate = async () => {
    const payload = buildPayload()
    if (!payload) return
    try {
      await createLink.mutateAsync(payload)
      sendQuote.reset()
      toast.success('Payment link created')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create payment link')
    }
  }

  const handleSend = async () => {
    const payload = buildPayload()
    if (!payload || !selected) return
    const recipient = decodeRecipientId(selected.id)
    if (!recipient) return
    try {
      const response = await sendQuote.mutateAsync({ ...payload, recipient })
      createLink.reset()
      if (response.smsSent) toast.success(`Quote sent to ${selected.label}`)
      else toast.info('Quote saved — SMS not sent. Copy the link to share it.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send quote')
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4" aria-labelledby="custom-actions-title">
      <header>
        <h2 id="custom-actions-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Send className="h-4 w-4 text-primary" />
          Create or send
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Copy a payment link, or text it to a client or lead to pay on the portal.
        </p>
      </header>

      <div className="mt-4 space-y-3">
        <Button type="button" className="w-full" onClick={handleCreate} disabled={createDisabled}>
          {createLink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          Create payment link
        </Button>

        {createLink.data && <CustomLinkCreateResult checkout={createLink.data} />}

        <div className="border-t border-border pt-3">
          {selected ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-primary-light bg-primary-light/30 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">{selected.label}</span>
                {selected.hint && <span className="block truncate text-xs text-muted-foreground">{selected.hint}</span>}
              </span>
              <button
                type="button"
                onClick={() => { setSelected(null); setQuery(''); sendQuote.reset() }}
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Clear selected recipient"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <label htmlFor="custom-recipient" className="mb-1 block text-xs font-medium text-foreground">
                Recipient
              </label>
              <Combobox
                id="custom-recipient"
                items={items}
                query={query}
                loading={loading}
                onQueryChange={setQuery}
                onSelect={(item) => { setSelected(item); setQuery(''); sendQuote.reset() }}
                placeholder="Search clients or leads…"
                emptyMessage="No clients or leads match"
                aria-label="Search for a client or lead"
              />
            </>
          )}

          <Button type="button" className="mt-3 w-full" onClick={handleSend} disabled={sendDisabled}>
            {sendQuote.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send quote
          </Button>
        </div>

        <p className="min-h-5 text-xs text-muted-foreground" role="status" aria-live="polite">
          {disabledReason ?? ''}
          {errorMessage ? <span className="block text-error">{errorMessage}</span> : null}
        </p>

        {sendQuote.data && <CustomLinkSendResult result={sendQuote.data} />}
      </div>
    </section>
  )
}
