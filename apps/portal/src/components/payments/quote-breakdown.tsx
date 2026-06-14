/**
 * Itemized quote breakdown for the portal quote pay page. Groups lines into
 * Monthly and Setup/one-time, then shows "Due today" and (when recurring)
 * "Then $X/mo". Port of the workspace pricing-summary-panel, portal-styled.
 */
import { useTranslation } from 'react-i18next'
import { ReceiptText } from 'lucide-react'
import type { PublicQuoteView, QuoteLineView } from '../../lib/quote-api'
import { formatQuoteAmount } from '../../lib/quote-api'

interface QuoteBreakdownProps {
  view: PublicQuoteView
  language: string
}

export function QuoteBreakdown({ view, language }: QuoteBreakdownProps) {
  const { t } = useTranslation()
  const monthlyItems = view.lineItems.filter((item) => item.kind === 'monthly')
  const setupItems = view.lineItems.filter((item) => item.kind === 'setup')
  const fmt = (value: number) => formatQuoteAmount(value, language)
  // Custom yearly links bill once a year; everything else is monthly cadence.
  const isYearly = view.billingInterval === 'year'
  const recurringSuffix = isYearly ? '/yr' : '/mo'
  const recurringTotal = Math.max(0, view.monthlyTotal - (view.discount?.recurringAmount ?? 0))
  const discountLabel = view.discount
    ? t('quote.discountLabel', { code: view.discount.code })
    : ''

  return (
    <section aria-labelledby="quote-summary-title">
      <h2
        id="quote-summary-title"
        className="flex items-center gap-2 text-base font-semibold text-foreground"
      >
        <ReceiptText className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
        {t('quote.summaryTitle')}
      </h2>

      <div className="mt-5 space-y-7">
        {monthlyItems.length > 0 && (
          <LineGroup
            title={isYearly ? t('quote.yearlyGroup') : t('quote.monthlyGroup')}
            items={monthlyItems}
            fmt={fmt}
          />
        )}
        {setupItems.length > 0 && (
          <LineGroup
            title={t('quote.setupGroup')}
            items={setupItems}
            fmt={fmt}
          />
        )}
      </div>

      <dl className="mt-6 divide-y divide-border rounded-xl border border-border/70 bg-muted/30">
        {view.discount && (
          <>
            <TotalRow label={t('quote.subtotal')} value={fmt(view.subtotal)} />
            <TotalRow label={discountLabel} value={`-${fmt(view.discount.amount)}`} />
          </>
        )}
        <TotalRow label={t('quote.dueToday')} value={fmt(view.dueToday)} strong />
        {view.monthlyTotal > 0 && (
          <TotalRow
            label={t('quote.recurringAfterToday')}
            value={`${fmt(recurringTotal)}${recurringSuffix}`}
          />
        )}
      </dl>
    </section>
  )
}

function LineGroup({
  title,
  items,
  fmt,
}: {
  title: string
  items: QuoteLineView[]
  fmt: (value: number) => string
}) {
  return (
    <div>
      <h3 className="mb-3.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ul className="space-y-3.5">
        {items.map((item) => (
          <li
            key={`${item.kind}-${item.label}`}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 text-[0.9375rem] leading-7"
          >
            <span className="min-w-0">
              <span className="text-muted-foreground">{item.label}</span>
              {item.description && (
                <span className="mt-0.5 block text-[0.8125rem] leading-snug text-muted-foreground/70">
                  {item.description}
                </span>
              )}
            </span>
            <span className="font-medium tabular-nums text-foreground">{fmt(item.amount)}</span>
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
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <dt
        className={strong ? 'text-sm font-semibold text-foreground' : 'text-sm text-muted-foreground'}
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
        {value}
      </dd>
    </div>
  )
}
