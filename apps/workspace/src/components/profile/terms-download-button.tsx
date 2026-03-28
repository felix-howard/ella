/**
 * Terms Download Button - Shows signed T&C status with download option
 * Staff can download own; admins can download any team member's PDF
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Download, FileText, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@ella/ui'
import { api } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'

interface TermsDownloadButtonProps {
  staffId: string
  className?: string
}

export function TermsDownloadButton({ staffId, className }: TermsDownloadButtonProps) {
  const { t } = useTranslation()
  const [isDownloading, setIsDownloading] = useState(false)

  const { data: acceptance, isLoading, error } = useQuery({
    queryKey: ['terms-acceptance', staffId],
    queryFn: () => api.terms.getAcceptance(staffId),
    retry: false,
  })

  const handleDownload = async () => {
    if (!acceptance) return

    setIsDownloading(true)
    try {
      const { url } = await api.terms.getDownloadUrl(acceptance.id)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      console.error('[TermsDownload] Failed:', err)
      toast.error(t('terms.downloadError', 'Failed to download. Please try again.'))
    } finally {
      setIsDownloading(false)
    }
  }

  if (isLoading) {
    return (
      <div className={className}>
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !acceptance) {
    return (
      <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className ?? ''}`}>
        <AlertCircle className="w-4 h-4" />
        {t('terms.notAccepted', 'Terms not yet accepted')}
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {t('terms.signedTerms', 'Signed Terms & Conditions')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('terms.signedVersion', 'Version {{version}} - Signed {{date}}', {
                version: acceptance.version,
                date: new Date(acceptance.signedAt).toLocaleDateString(),
              })}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              {t('common.download', 'Download')}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
