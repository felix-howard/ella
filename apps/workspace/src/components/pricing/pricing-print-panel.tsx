import { Button } from '@ella/ui'
import { FileText, Printer } from 'lucide-react'
import {
  encodePricingQuote,
  isPricingInputSane,
  type PricingCalculatorInput,
  type PricingCalculatorResult,
} from '@ella/shared/pricing'
import { toast } from '../../stores/toast-store'

interface PricingPrintPanelProps {
  input: PricingCalculatorInput
  result: PricingCalculatorResult
}

export function PricingPrintPanel({ input, result }: PricingPrintPanelProps) {
  const disabledReason = getPrintDisabledReason(input, result)

  const handlePrint = () => {
    if (disabledReason) return
    const printWindow = window.open(buildPricingPrintUrl(input), '_blank')
    if (!printWindow) {
      toast.error('Popup blocked. Allow popups, then try Print PDF again.')
    } else {
      printWindow.opener = null
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

function getPrintDisabledReason(input: PricingCalculatorInput, result: PricingCalculatorResult): string | null {
  if (!isPricingInputSane(input)) return 'Quantity limits exceeded. Use manual follow-up.'
  if (result.isEnterprise) return 'VIP quotes require manual follow-up.'
  if (!result.hasAnySelection) return 'Select at least one billable service before printing a quote.'
  return null
}

function buildPricingPrintUrl(input: PricingCalculatorInput): string {
  const baseUrl = getLandingBaseUrl()
  const url = new URL('/pricing/print', baseUrl)
  url.searchParams.set('q', encodePricingQuote(input))
  return url.toString()
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
