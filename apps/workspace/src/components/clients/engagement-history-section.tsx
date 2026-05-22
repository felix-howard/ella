/**
 * EngagementHistorySection - Displays client's tax filing history across years
 * Shows engagements with tax year, status, and case count
 */

import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Calendar, FileText, Loader2 } from 'lucide-react'
import { cn } from '@ella/ui'
import { api, type TaxEngagement, type EngagementStatus } from '../../lib/api-client'

interface EngagementHistorySectionProps {
  clientId: string
  currentTaxYear?: number
}

// Status display config
const STATUS_CONFIG: Record<EngagementStatus, { labelKey: string; className: string }> = {
  DRAFT: { labelKey: 'engagementStatus.draft', className: 'bg-muted text-muted-foreground' },
  ACTIVE: { labelKey: 'engagementStatus.active', className: 'bg-primary-light text-primary' },
  COMPLETE: { labelKey: 'engagementStatus.complete', className: 'bg-success-light text-success' },
  ARCHIVED: { labelKey: 'engagementStatus.archived', className: 'bg-muted text-muted-foreground' },
}

export function EngagementHistorySection({ clientId, currentTaxYear }: EngagementHistorySectionProps) {
  const { t } = useTranslation()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['engagements', clientId],
    queryFn: () => api.engagements.list({ clientId, limit: 10 }),
  })

  const engagements = data?.data ?? []

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-primary">{t('engagementHistory.title')}</h2>
        </div>
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-primary">{t('engagementHistory.title')}</h2>
        </div>
        <p className="text-sm text-muted-foreground py-4 text-center">
          {t('engagementHistory.loadError')}
        </p>
      </div>
    )
  }

  if (engagements.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-primary">{t('engagementHistory.title')}</h2>
        </div>
        <p className="text-sm text-muted-foreground py-4 text-center">
          {t('engagementHistory.empty')}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-primary">{t('engagementHistory.title')}</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {t('engagementHistory.yearCount', { count: engagements.length })}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {t('engagementHistory.switchYearHint')}
        </span>
      </div>

      <div className="space-y-2">
        {engagements.map((engagement) => (
          <EngagementRow
            key={engagement.id}
            engagement={engagement}
            isCurrent={engagement.taxYear === currentTaxYear}
          />
        ))}
      </div>
    </div>
  )
}

interface EngagementRowProps {
  engagement: TaxEngagement
  isCurrent?: boolean
}

function EngagementRow({ engagement, isCurrent }: EngagementRowProps) {
  const { t } = useTranslation()
  const statusConfig = STATUS_CONFIG[engagement.status]
  const caseCount = engagement._count?.taxCases ?? 0

  return (
    <div
      className={cn(
        'flex items-center justify-between p-3 rounded-lg border transition-colors',
        isCurrent
          ? 'border-primary bg-primary-light/30'
          : 'border-border bg-muted/20 hover:bg-muted/40'
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">
            {engagement.taxYear}
            {isCurrent && (
              <span className="ml-2 text-xs font-normal text-primary">{t('common.current')}</span>
            )}
          </span>
          <span className="text-xs text-muted-foreground">
            {engagement.filingStatus || t('engagementHistory.noFilingStatus')}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Case count */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <FileText className="w-3.5 h-3.5" />
          <span>{t('engagementHistory.caseCount', { count: caseCount })}</span>
        </div>

        {/* Status badge */}
        <span
          className={cn(
            'px-2 py-0.5 text-xs font-medium rounded-full',
            statusConfig.className
          )}
        >
          {t(statusConfig.labelKey)}
        </span>
      </div>
    </div>
  )
}
