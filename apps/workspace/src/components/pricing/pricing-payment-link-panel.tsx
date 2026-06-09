import { Button, Input } from '@ella/ui'
import { Copy, ExternalLink, Link2, Loader2 } from 'lucide-react'
import { copyToClipboard } from '../../lib/clipboard'
import type { PricingCheckout } from './pricing-calculator-types'

interface PricingPaymentLinkPanelProps {
  checkout: PricingCheckout
  disabledReason: string | null
  errorMessage: string | null
  isCreating: boolean
  quoteChanged: boolean
  onCreate: () => Promise<void>
}

export function PricingPaymentLinkPanel({
  checkout,
  disabledReason,
  errorMessage,
  isCreating,
  quoteChanged,
  onCreate,
}: PricingPaymentLinkPanelProps) {
  const createDisabled = Boolean(disabledReason) || isCreating

  const handleCreate = async () => {
    try {
      await onCreate()
    } catch {
      // Mutation owner shows the toast and inline error.
    }
  }

  const handleCopy = () => {
    if (!checkout?.checkoutUrl) return
    void copyToClipboard(checkout.checkoutUrl, { successMsg: 'Payment link copied' })
  }

  const handleOpen = () => {
    if (!checkout?.checkoutUrl) return
    window.open(checkout.checkoutUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4" aria-labelledby="payment-link-title">
      <header>
        <h2 id="payment-link-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Link2 className="h-4 w-4 text-primary" />
          Payment link
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">Create a Stripe Checkout URL with your workspace session.</p>
      </header>

      <div className="mt-4 space-y-3">
        <Button type="button" className="w-full" onClick={handleCreate} disabled={createDisabled}>
          {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          Create payment link
        </Button>

        <p className="min-h-5 text-xs text-muted-foreground" role="status" aria-live="polite">
          {disabledReason ?? (quoteChanged ? 'Quote changed. Create a new link before sharing.' : '')}
          {errorMessage ? <span className="block text-error">{errorMessage}</span> : null}
        </p>

        {checkout && (
          <div className="space-y-3 rounded-lg border border-primary-light bg-primary-light/30 p-3">
            <p className="text-xs font-medium text-primary-dark">Quote {checkout.quoteId}</p>
            <label htmlFor="pricing-checkout-url" className="block text-xs font-medium text-foreground">
              Stripe Checkout URL
              <Input id="pricing-checkout-url" type="url" readOnly value={checkout.checkoutUrl} className="mt-1 overflow-hidden text-ellipsis" />
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" onClick={handleCopy}>
                <Copy className="h-4 w-4" />
                Copy
              </Button>
              <Button type="button" variant="outline" onClick={handleOpen}>
                <ExternalLink className="h-4 w-4" />
                Open
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
