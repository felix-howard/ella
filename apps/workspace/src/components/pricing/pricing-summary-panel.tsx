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
    <section
      className="rounded-lg border border-border bg-card p-5 sm:p-6"
      aria-labelledby="pricing-summary-title"
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="pricing-summary-title"
            className="flex items-center gap-2 text-sm font-semibold text-foreground"
          >
            <ReceiptText className="h-4 w-4 text-primary" />
            Quote summary
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Monthly services plus setup and one-time work.
          </p>
        </div>
        <Badge variant={result.isEnterprise ? 'warning' : 'success'} className="shrink-0">
          {result.tierLabel}
        </Badge>
      </header>

      {result.isEnterprise && (
        <p className="mt-4 rounded-lg border border-warning-light bg-warning-light/40 px-3 py-2 text-xs text-warning">
          VIP quotes require manual follow-up and cannot create checkout links.
        </p>
      )}

      <div className="mt-6 space-y-6">
        <LineGroup title="Monthly" items={result.monthlyItems} total={result.monthlyTotal} />
        {result.yearlyItems.length > 0 && (
          <LineGroup title="Yearly" items={result.yearlyItems} total={result.yearlyTotal} />
        )}
        <LineGroup
          title="Setup and one-time"
          items={result.setupDisplayItems}
          total={result.setupDisplayTotal}
        />
      </div>

      <dl className="mt-6 divide-y divide-border rounded-lg border border-border/70">
        <TotalRow label="Due today" value={dueToday} strong />
        <TotalRow label="Next month onward" value={result.monthlyTotal} />
      </dl>
    </section>
  )
}

function LineGroup({
  title,
  items,
  total,
}: {
  title: string
  items: PricingLineItem[]
  total: number
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span>{title}</span>
        <span className="tabular-nums">{formatCurrency(total)}</span>
      </div>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li
            key={`${item.kind}-${item.label}`}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-sm leading-6"
          >
            <span className="min-w-0 text-muted-foreground">
              {item.label}
              {item.note && (
                <span className="block text-xs leading-5 text-muted-foreground/80">
                  {item.note}
                </span>
              )}
            </span>
            <span className="font-medium tabular-nums text-foreground">
              {formatCurrency(item.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TotalRow({
  label,
  value,
  strong = false,
}: {
  label: string
  value: number
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <dt
        className={
          strong ? 'text-sm font-semibold text-foreground' : 'text-sm text-muted-foreground'
        }
      >
        {label}
      </dt>
      <dd
        className={
          strong
            ? 'text-xl font-semibold tabular-nums text-foreground'
            : 'text-base font-medium tabular-nums text-foreground'
        }
      >
        {formatCurrency(value)}
      </dd>
    </div>
  )
}
