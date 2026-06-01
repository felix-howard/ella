import type { PricingCalculatorResult, PricingLineItem } from '@ella/shared/pricing'
import { Badge } from '@ella/ui'
import { ReceiptText } from 'lucide-react'
import { formatCurrency } from './pricing-format'

interface PricingSummaryPanelProps {
  result: PricingCalculatorResult
}

export function PricingSummaryPanel({ result }: PricingSummaryPanelProps) {
  const dueToday = result.monthlyTotal + result.setupTotal

  return (
    <section className="rounded-lg border border-border bg-card p-4" aria-labelledby="pricing-summary-title">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 id="pricing-summary-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ReceiptText className="h-4 w-4 text-primary" />
            Quote summary
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Monthly services plus setup and one-time work.</p>
        </div>
        <Badge variant={result.isEnterprise ? 'warning' : 'success'}>{result.tierLabel}</Badge>
      </header>

      {result.isEnterprise && (
        <p className="mt-4 rounded-lg border border-warning-light bg-warning-light/40 px-3 py-2 text-xs text-warning">
          VIP quotes require manual follow-up and cannot create checkout links.
        </p>
      )}

      <div className="mt-4 space-y-4">
        <LineGroup title="Monthly" items={result.monthlyItems} total={result.monthlyTotal} />
        <LineGroup title="Setup and one-time" items={result.setupItems} total={result.setupTotal} />
      </div>

      <dl className="mt-4 divide-y divide-border rounded-lg border border-border/70">
        <TotalRow label="Due today" value={dueToday} strong />
        <TotalRow label="Next month onward" value={result.monthlyTotal} />
      </dl>
    </section>
  )
}

function LineGroup({ title, items, total }: { title: string; items: PricingLineItem[]; total: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold uppercase text-muted-foreground">
        <span>{title}</span>
        <span>{formatCurrency(total)}</span>
      </div>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={`${item.kind}-${item.label}`} className="flex items-start justify-between gap-3 text-sm">
            <span className="min-w-0 text-muted-foreground">
              {item.label}
              {item.note && <span className="block text-xs text-muted-foreground/80">{item.note}</span>}
            </span>
            <span className="shrink-0 font-medium tabular-nums text-foreground">{formatCurrency(item.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TotalRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <dt className={strong ? 'text-sm font-semibold text-foreground' : 'text-sm text-muted-foreground'}>{label}</dt>
      <dd className={strong ? 'text-lg font-semibold tabular-nums text-foreground' : 'text-sm font-medium tabular-nums text-foreground'}>{formatCurrency(value)}</dd>
    </div>
  )
}
