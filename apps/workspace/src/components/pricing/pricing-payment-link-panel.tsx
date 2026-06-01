import { useState } from 'react'
import { Button, Input } from '@ella/ui'
import { Copy, ExternalLink, Link2, Loader2 } from 'lucide-react'
import { copyToClipboard } from '../../lib/clipboard'
import type { PricingCheckout, PricingCustomerFields } from './pricing-calculator-types'

interface PricingPaymentLinkPanelProps {
  checkout: PricingCheckout
  disabledReason: string | null
  errorMessage: string | null
  fields: PricingCustomerFields
  isCreating: boolean
  quoteChanged: boolean
  onFieldsChange: (fields: PricingCustomerFields) => void
  onCreate: (fields: PricingCustomerFields) => Promise<void>
}

export function PricingPaymentLinkPanel({
  checkout,
  disabledReason,
  errorMessage,
  fields,
  isCreating,
  quoteChanged,
  onFieldsChange,
  onCreate,
}: PricingPaymentLinkPanelProps) {
  const [emailError, setEmailError] = useState<string | null>(null)
  const email = fields.customerEmail.trim()
  const emailValidationMessage = 'Enter a valid email or leave it blank.'
  const emailInvalid = Boolean(email) && !isValidEmail(email)
  const visibleEmailError = emailError ?? (emailInvalid ? emailValidationMessage : null)
  const createDisabled = Boolean(disabledReason) || emailInvalid || isCreating
  const emailErrorId = 'pricing-customer-email-error'

  const updateField = (key: keyof PricingCustomerFields, value: string) => {
    onFieldsChange({ ...fields, [key]: value })
    if (key === 'customerEmail') setEmailError(null)
  }

  const handleCreate = async () => {
    if (emailInvalid) {
      setEmailError(emailValidationMessage)
      return
    }
    try {
      await onCreate(fields)
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
        <label htmlFor="pricing-customer-email" className="block text-xs font-medium text-foreground">
          Customer email optional
          <Input
            id="pricing-customer-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={fields.customerEmail}
            disabled={isCreating}
            onChange={(event) => updateField('customerEmail', event.target.value)}
            className="mt-1"
            placeholder="client@example.com"
            aria-invalid={Boolean(visibleEmailError)}
            aria-describedby={visibleEmailError ? emailErrorId : undefined}
          />
        </label>
        {visibleEmailError && <p id={emailErrorId} className="text-xs text-error">{visibleEmailError}</p>}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <TextField id="pricing-customer-name" label="Customer name" value={fields.customerName} placeholder="Jane Nguyen" disabled={isCreating} onChange={(value) => updateField('customerName', value)} />
          <TextField id="pricing-business-name" label="Business" value={fields.businessName} placeholder="Salon LLC" disabled={isCreating} onChange={(value) => updateField('businessName', value)} />
        </div>

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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function TextField({ id, label, value, placeholder, disabled, onChange }: { id: string; label: string; value: string; placeholder: string; disabled: boolean; onChange: (value: string) => void }) {
  return (
    <label htmlFor={id} className="block text-xs font-medium text-foreground">
      {label}
      <Input id={id} type="text" value={value} disabled={disabled} autoComplete={label === 'Business' ? 'organization' : 'name'} onChange={(event) => onChange(event.target.value)} className="mt-1" placeholder={placeholder} />
    </label>
  )
}
