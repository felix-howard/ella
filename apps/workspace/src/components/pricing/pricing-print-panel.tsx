import { Button } from '@ella/ui'
import { FileText, Printer } from 'lucide-react'
import {
  encodePricingQuote,
  type PricingCalculatorInput,
  type PricingCalculatorResult,
} from '@ella/shared/pricing'
import { toast } from '../../stores/toast-store'
import { getPrintDisabledReason } from './pricing-disabled-reasons'

interface PricingPrintPanelProps {
  input: PricingCalculatorInput
  result: PricingCalculatorResult
}

export const PRICING_PRINT_QUOTE_MESSAGE_TYPE = 'ella:pricing-print-quote'

interface PricingPrintQuoteMessage {
  type: typeof PRICING_PRINT_QUOTE_MESSAGE_TYPE
  quote: string
}

export function PricingPrintPanel({ input, result }: PricingPrintPanelProps) {
  const disabledReason = getPrintDisabledReason(input, result)

  const handlePrint = () => {
    if (disabledReason) return
    const printWindow = window.open(buildPricingPrintUrl(), '_blank')
    if (!printWindow) {
      toast.error('Popup blocked. Allow popups, then try Print PDF again.')
    } else {
      sendPricingPrintQuote(printWindow, input)
      try {
        printWindow.opener = null
      } catch {
        // Cross-origin windows can reject opener writes in hardened browsers.
      }
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4" aria-labelledby="quote-pdf-title">
      <header>
        <h2 id="quote-pdf-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <FileText className="h-4 w-4 text-primary" />
          Quote PDF
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">Open a formal print-ready quote for this calculation.</p>
      </header>

      <div className="mt-4 space-y-3">
        <Button type="button" className="w-full" onClick={handlePrint} disabled={Boolean(disabledReason)}>
          <Printer className="h-4 w-4" />
          Print PDF
        </Button>
        <p className="min-h-5 text-xs text-muted-foreground" role="status" aria-live="polite">
          {disabledReason ?? 'Ready to open a formal print-ready quote.'}
        </p>
      </div>
    </section>
  )
}

export function buildPricingPrintUrl(): string {
  const baseUrl = getLandingBaseUrl()
  const url = new URL('/pricing/print', baseUrl)
  return url.toString()
}

export function buildPricingPrintMessage(input: PricingCalculatorInput): PricingPrintQuoteMessage {
  return {
    type: PRICING_PRINT_QUOTE_MESSAGE_TYPE,
    quote: encodePricingQuote(input),
  }
}

function sendPricingPrintQuote(printWindow: Window, input: PricingCalculatorInput): void {
  const message = buildPricingPrintMessage(input)
  const targetOrigin = new URL(getLandingBaseUrl()).origin
  let attempts = 0
  const maxAttempts = 20

  const send = () => {
    if (printWindow.closed) {
      return
    }
    printWindow.postMessage(message, targetOrigin)
    attempts += 1
    if (attempts < maxAttempts) window.setTimeout(send, 250)
  }

  send()
}

function getLandingBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_LANDING_URL?.trim()
  if (configuredUrl) return configuredUrl
  if (typeof window !== 'undefined' && isLocalHost(window.location.hostname)) return 'http://localhost:4321'
  return 'https://ella.tax'
}

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1'
}
