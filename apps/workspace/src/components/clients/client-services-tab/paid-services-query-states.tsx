import { AlertCircle, BriefcaseBusiness, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function PaidServicesLoading() {
  const { t } = useTranslation()
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{t('clientServices.loading')}</span>
      <div className="space-y-3" aria-hidden="true">
        {[0, 1].map((index) => (
          <div
            key={index}
            className="animate-pulse rounded-xl border border-border/60 p-4 motion-reduce:animate-none"
          >
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="mt-3 h-3 w-28 rounded bg-muted" />
            <div className="mt-4 h-12 rounded bg-muted/70" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function PaidServicesError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center"
    >
      <AlertCircle className="mx-auto size-7 text-destructive" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold text-destructive">
        {t('clientServices.errorTitle')}
      </p>
      <p className="mx-auto mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
        {t('clientServices.errorDescription')}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <RefreshCw className="size-4" aria-hidden="true" />
        {t('clientServices.retry')}
      </button>
    </div>
  )
}

export function PaidServicesEmpty() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <BriefcaseBusiness className="size-5" aria-hidden="true" />
      </div>
      <p className="mt-3 text-sm font-semibold text-foreground">
        {t('clientServices.emptyTitle')}
      </p>
      <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
        {t('clientServices.emptyDescription')}
      </p>
    </div>
  )
}

export function PaidServicesTruncated({ limit }: { limit: number }) {
  const { t } = useTranslation()
  return (
    <div
      role="status"
      className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
    >
      {t('clientServices.truncated', { limit })}
    </div>
  )
}
