import { Button, Input } from '@ella/ui'
import { Copy, ExternalLink } from 'lucide-react'
import type { CheckoutSessionResponse, SendQuoteResponse } from '../../../lib/api-client'
import { copyToClipboard } from '../../../lib/clipboard'

/** Result box for a created custom payment link — copy/open the Stripe URL. */
export function CustomLinkCreateResult({ checkout }: { checkout: CheckoutSessionResponse }) {
  const handleCopy = () => void copyToClipboard(checkout.checkoutUrl, { successMsg: 'Payment link copied' })
  const handleOpen = () => window.open(checkout.checkoutUrl, '_blank', 'noopener,noreferrer')

  return (
    <div className="space-y-3 rounded-lg border border-primary-light bg-primary-light/30 p-3">
      <p className="text-xs font-medium text-primary-dark">Quote {checkout.quoteId}</p>
      <label htmlFor="custom-checkout-url" className="block text-xs font-medium text-foreground">
        Stripe Checkout URL
        <Input
          id="custom-checkout-url"
          type="url"
          readOnly
          value={checkout.checkoutUrl}
          className="mt-1 overflow-hidden text-ellipsis"
        />
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
  )
}

/** Result box for a sent custom quote — SMS status + copy-link fallback. */
export function CustomLinkSendResult({ result }: { result: SendQuoteResponse }) {
  const handleCopy = () => void copyToClipboard(result.payUrl, { successMsg: 'Quote link copied' })

  return (
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
  )
}
