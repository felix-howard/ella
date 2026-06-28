/**
 * Post-sign confirmation screen. Displays the signed-at timestamp and a link
 * to download the signed PDF (presigned, short-lived URL served by API).
 */
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Clock3, Download, FileCheck2, ShieldCheck } from 'lucide-react'
import { buttonVariants, cn } from '@ella/ui'

interface AgreementConfirmationPanelProps {
  signedAt: string
  downloadUrl: string
  orgName: string
  documentLabel?: string
}

export function AgreementConfirmationPanel({
  signedAt,
  downloadUrl,
  orgName,
  documentLabel,
}: AgreementConfirmationPanelProps) {
  const { t, i18n } = useTranslation()
  const label = documentLabel?.trim() || t('nda.documentLabel.generic')

  const formattedDate = new Date(signedAt).toLocaleString(
    i18n.language === 'vi' ? 'vi-VN' : 'en-US',
    { dateStyle: 'long', timeStyle: 'short' },
  )

  return (
    <section
      className="relative min-h-[calc(100dvh-9rem)] overflow-hidden py-8 sm:py-12"
      role="status"
      aria-live="polite"
    >
      <div
        className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary-light/70 to-transparent"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex w-full max-w-2xl flex-col items-center px-0 sm:px-4">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card px-4 py-2 text-sm font-semibold text-primary-dark shadow-sm">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          {t('nda.secureSigning')}
        </div>

        <div className="w-full overflow-hidden rounded-lg border border-border bg-card text-center shadow-lg shadow-slate-200/70">
          <div className="h-1.5 bg-primary" aria-hidden="true" />
          <div className="px-6 py-8 sm:px-10 sm:py-10">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-light">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card shadow-sm">
                <CheckCircle2 className="h-8 w-8 text-primary-dark" aria-hidden="true" />
              </div>
            </div>

            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {t('nda.confirmedTitle')}
            </h2>

            <p className="mx-auto mt-3 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">
              {t('nda.confirmedMessage', { orgName, documentLabel: label })}
            </p>

            <dl className="mx-auto mt-7 max-w-lg divide-y divide-border border-y border-border text-left">
              <div className="flex items-start gap-3 py-4">
                <FileCheck2
                  className="mt-0.5 h-5 w-5 shrink-0 text-primary-dark"
                  aria-hidden="true"
                />
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('nda.signedAtLabel')}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-foreground sm:text-base">
                    <time dateTime={signedAt}>{formattedDate}</time>
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-3 py-4">
                <Clock3
                  className="mt-0.5 h-5 w-5 shrink-0 text-primary-dark"
                  aria-hidden="true"
                />
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    PDF
                  </dt>
                  <dd className="mt-1 text-sm text-muted-foreground sm:text-base">
                    {t('nda.downloadTtlHint')}
                  </dd>
                </div>
              </div>
            </dl>

            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ size: 'lg' }),
                'mt-8 min-h-12 w-full px-8 text-base font-semibold shadow-md shadow-primary/20 sm:w-auto sm:px-10',
              )}
            >
              <Download className="h-5 w-5" aria-hidden="true" />
              {t('nda.downloadCopy')}
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
