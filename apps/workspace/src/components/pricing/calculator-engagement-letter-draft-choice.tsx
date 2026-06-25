import { FilePenLine } from 'lucide-react'
import type { TFunction } from 'i18next'
import { AgreementSourceBadge } from '../agreements/agreement-status-badges'
import { formatShortRelativeTime } from '../../lib/formatters'
import type { Agreement } from '../../lib/api-client'

interface CalculatorEngagementLetterDraftChoiceProps {
  draft: Agreement
  language: string
  onResume: () => void
  onStartCurrent: () => void
  onCancel: () => void
  t: TFunction
}

export function CalculatorEngagementLetterDraftChoice({
  draft,
  language,
  onResume,
  onStartCurrent,
  onCancel,
  t,
}: CalculatorEngagementLetterDraftChoiceProps) {
  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <AgreementSourceBadge source="CALCULATOR" />
        <span className="text-xs font-medium text-muted-foreground">
          {t('pricing.engagementLetterDraft.calculatorDraft')}
        </span>
      </div>
      <h4 className="mt-3 text-base font-semibold text-foreground">
        {t('pricing.engagementLetterDraft.choiceTitle')}
      </h4>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {t('pricing.engagementLetterDraft.choiceDescription')}
      </p>
      <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex items-start gap-3">
          <FilePenLine className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{draft.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('pricing.engagementLetterDraft.choiceUpdated', {
                time: formatShortRelativeTime(draft.updatedAt, language),
              })}
            </p>
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={onStartCurrent}
          className="rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          {t('pricing.engagementLetterDraft.startCurrent')}
        </button>
        <button
          type="button"
          onClick={onResume}
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t('pricing.engagementLetterDraft.resumeSaved')}
        </button>
      </div>
    </div>
  )
}
