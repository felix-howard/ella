/**
 * Row in the Schedule C business summary list — one per linked Schedule-C-eligible
 * business that already has a Schedule C record. Read-only; navigates to the business
 * detail page on "Open" so the CPA can manage the SC there.
 */
import { Link } from '@tanstack/react-router'
import { ExternalLink, Building2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { buttonVariants, cn } from '@ella/ui'
import type { ClientPreview } from '../../../../lib/api-client'
import { BUSINESS_TYPE_LABELS } from '../../../../lib/business-type-helpers'
import { StatusBadge } from './status-badge'

interface ScheduleCBusinessSummaryRowProps {
  business: ClientPreview
}

export function ScheduleCBusinessSummaryRow({ business }: ScheduleCBusinessSummaryRowProps) {
  const { t } = useTranslation()
  const sc = business.scheduleCExpense
  if (!sc) return null

  const typeLabel = business.businessType
    ? BUSINESS_TYPE_LABELS[business.businessType] ?? business.businessType
    : null

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-medium text-foreground">
              {business.name}
            </span>
            {typeLabel && (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {typeLabel}
              </span>
            )}
          </div>
          <div className="mt-1">
            <StatusBadge status={sc.status} />
          </div>
        </div>
      </div>
      <Link
        to="/clients/$clientId"
        params={{ clientId: business.id }}
        search={{ tab: 'schedule-c' }}
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0 gap-1.5')}
        aria-label={t('scheduleC.openBusinessLabel', {
          defaultValue: 'Open Schedule C for {{name}}',
          name: business.name,
        })}
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        {t('common.open', { defaultValue: 'Open' })}
      </Link>
    </div>
  )
}
