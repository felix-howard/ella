import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  calculatePricing,
  createDefaultPricingInput,
  isPricingCheckoutAmountSane,
  isPricingInputSane,
  type PricingCalculatorInput,
} from '@ella/shared/pricing'
import { toast } from '../../stores/toast-store'
import { api } from '../../lib/api-client'
import { PricingCalculatorForm } from './pricing-calculator-form'
import { PricingPaymentLinkPanel } from './pricing-payment-link-panel'
import { PricingPrintPanel } from './pricing-print-panel'
import { PricingSummaryPanel } from './pricing-summary-panel'
import { serializePricingInput, trimOptional } from './pricing-format'
import type { PricingCheckout, PricingCustomerFields } from './pricing-calculator-types'

interface CreateLinkPayload {
  pricingInput: PricingCalculatorInput
  fields: PricingCustomerFields
}

export function PricingCalculatorPage() {
  const defaults = useMemo(() => createDefaultPricingInput(), [])
  const [input, setInput] = useState<PricingCalculatorInput>(() => createDefaultPricingInput())
  const [customerFields, setCustomerFields] = useState<PricingCustomerFields>({
    customerEmail: '',
    customerName: '',
    businessName: '',
  })
  const [checkout, setCheckout] = useState<PricingCheckout>(null)
  const [quoteChanged, setQuoteChanged] = useState(false)
  const [lastCheckoutSignature, setLastCheckoutSignature] = useState<string | null>(null)
  const result = useMemo(() => calculatePricing(input), [input])
  const currentCheckoutSignature = makeCheckoutSignature(input, customerFields)
  const currentCheckoutSignatureRef = useRef(currentCheckoutSignature)

  useEffect(() => {
    currentCheckoutSignatureRef.current = currentCheckoutSignature
  }, [currentCheckoutSignature])

  const createLinkMutation = useMutation({
    mutationFn: ({ pricingInput, fields }: CreateLinkPayload) =>
      api.billing.createCheckoutSession({
        pricingInput,
        customerEmail: trimOptional(fields.customerEmail),
        customerName: trimOptional(fields.customerName),
        businessName: trimOptional(fields.businessName),
      }),
    onSuccess: (response, variables) => {
      const responseSignature = makeCheckoutSignature(variables.pricingInput, variables.fields)
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
      makeCheckoutSignature(nextInput, customerFields) !== lastCheckoutSignature
    ) {
      setCheckout(null)
      setQuoteChanged(true)
    }
    setInput(nextInput)
  }

  const handleCustomerFieldsChange = (nextFields: PricingCustomerFields) => {
    if (
      checkout &&
      lastCheckoutSignature &&
      makeCheckoutSignature(input, nextFields) !== lastCheckoutSignature
    ) {
      setCheckout(null)
      setQuoteChanged(true)
    }
    setCustomerFields(nextFields)
  }

  const handleCreate = async (fields: PricingCustomerFields) => {
    await createLinkMutation.mutateAsync({ pricingInput: input, fields })
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Pricing Calculator</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Build a workspace quote and create a Stripe Checkout link without a pasted token.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <PricingCalculatorForm
          input={input}
          defaults={defaults}
          disabled={createLinkMutation.isPending}
          onInputChange={handleInputChange}
        />
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <PricingSummaryPanel result={result} />
          <PricingPrintPanel input={input} result={result} />
          <PricingPaymentLinkPanel
            checkout={checkout}
            disabledReason={disabledReason}
            errorMessage={errorMessage}
            fields={customerFields}
            isCreating={createLinkMutation.isPending}
            quoteChanged={quoteChanged}
            onFieldsChange={handleCustomerFieldsChange}
            onCreate={handleCreate}
          />
        </aside>
      </div>
    </section>
  )
}

function getCreateDisabledReason(
  input: PricingCalculatorInput,
  result: ReturnType<typeof calculatePricing>
): string | null {
  const hasMeaningfulSelection = result.hasAnySelection || input.nec1099Count > 0
  const payableTotal = result.monthlyTotal + result.setupTotal

  if (!hasMeaningfulSelection) return 'Select at least one billable service before creating a link.'
  if (result.isEnterprise) return 'VIP quotes require manual follow-up.'
  if (!isPricingInputSane(input)) return 'Quantity limits exceeded. Use manual follow-up.'
  if (!isPricingCheckoutAmountSane(result)) {
    return 'Quote total is too large for checkout. Use manual follow-up.'
  }
  if (payableTotal <= 0) return 'Payable total must be greater than $0.'
  return null
}

function makeCheckoutSignature(
  input: PricingCalculatorInput,
  fields: PricingCustomerFields
): string {
  return JSON.stringify({
    pricingInput: JSON.parse(serializePricingInput(input)) as PricingCalculatorInput,
    customerEmail: trimOptional(fields.customerEmail),
    customerName: trimOptional(fields.customerName),
    businessName: trimOptional(fields.businessName),
  })
}
