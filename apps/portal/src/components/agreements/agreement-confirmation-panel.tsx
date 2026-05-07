/**
 * Post-sign confirmation screen. Displays the signed-at timestamp and a link
 * to download the signed PDF (presigned, short-lived URL served by API).
 */
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Download } from 'lucide-react'
import { Button } from '@ella/ui'

interface AgreementConfirmationPanelProps {
  signedAt: string
  downloadUrl: string
  orgName: string
}

export function AgreementConfirmationPanel({
  signedAt,
  downloadUrl,
  orgName,
}: AgreementConfirmationPanelProps) {
  const { t, i18n } = useTranslation()

  const formattedDate = new Date(signedAt).toLocaleString(
    i18n.language === 'vi' ? 'vi-VN' : 'en-US',
    { dateStyle: 'long', timeStyle: 'short' },
  )

  return (
    <section
      className="flex-1 flex items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-sm p-6 sm:p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-primary-light flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-9 h-9 text-primary-dark" aria-hidden="true" />
        </div>

        <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight mb-2">
          {t('nda.confirmedTitle')}
        </h2>

        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-2">
          {t('nda.confirmedMessage', { orgName })}
        </p>
        <p className="text-xs text-muted-foreground mb-6">
          {t('nda.signedAtLabel')}: <span className="font-medium text-foreground/80">{formattedDate}</span>
        </p>

        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block"
        >
          <Button size="lg" className="gap-2 shadow-md">
            <Download className="w-4 h-4" />
            {t('nda.downloadCopy')}
          </Button>
        </a>

        <p className="text-xs text-muted-foreground mt-6">
          {t('nda.downloadTtlHint')}
        </p>
      </div>
    </section>
  )
}
