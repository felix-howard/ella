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
    <div className="flex-1 flex items-center justify-center p-6" role="status" aria-live="polite">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>

        <h2 className="text-xl font-semibold text-foreground mb-2">
          {t('nda.confirmedTitle')}
        </h2>

        <p className="text-muted-foreground mb-1">
          {t('nda.confirmedMessage', { orgName })}
        </p>
        <p className="text-xs text-muted-foreground mb-6">
          {t('nda.signedAtLabel')}: {formattedDate}
        </p>

        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block"
        >
          <Button className="gap-2">
            <Download className="w-4 h-4" />
            {t('nda.downloadCopy')}
          </Button>
        </a>

        <p className="text-xs text-muted-foreground mt-6">
          {t('nda.downloadTtlHint')}
        </p>
      </div>
    </div>
  )
}
