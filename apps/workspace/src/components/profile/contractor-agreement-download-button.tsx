/**
 * Contractor Agreement Download Button - Shows signed contractor agreement status
 * Staff can download own; admins can download any team member's PDF.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Download, FileText, Loader2 } from 'lucide-react'
import { Button } from '@ella/ui'
import { ApiError, api } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'

interface ContractorAgreementDownloadButtonProps {
  staffId: string
  isContractorAgent: boolean
  canViewAgreement: boolean
  className?: string
}

export function ContractorAgreementDownloadButton({
  staffId,
  isContractorAgent,
  canViewAgreement,
  className,
}: ContractorAgreementDownloadButtonProps) {
  const { t } = useTranslation()
  const [isDownloading, setIsDownloading] = useState(false)

  const { data: acceptance, isLoading, error } = useQuery({
    queryKey: ['contractor-agreement-acceptance', staffId],
    queryFn: () => api.contractorAgreements.getAcceptance(staffId),
    enabled: isContractorAgent && canViewAgreement,
    retry: false,
  })

  const handleDownload = async () => {
    if (!acceptance) return

    setIsDownloading(true)
    try {
      const { url } = await api.contractorAgreements.getDownloadUrl(acceptance.id)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      console.error('[ContractorAgreementDownload] Failed:', err)
      toast.error(t('contractorAgreement.downloadError', 'Failed to download. Please try again.'))
    } finally {
      setIsDownloading(false)
    }
  }

  if (!canViewAgreement) {
    return (
      <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className ?? ''}`}>
        <FileText className="w-4 h-4" />
        {t('contractorAgreement.restricted', 'Visible to member or admin only')}
      </div>
    )
  }

  if (!isContractorAgent) {
    return (
      <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className ?? ''}`}>
        <FileText className="w-4 h-4" />
        {t('contractorAgreement.notRequired', 'Not required')}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={className}>
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error instanceof ApiError && (error.status === 403 || error.code === 'FORBIDDEN')) {
    return (
      <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className ?? ''}`}>
        <FileText className="w-4 h-4" />
        {t('contractorAgreement.restricted', 'Visible to member or admin only')}
      </div>
    )
  }

  if (error instanceof ApiError && error.code === 'NOT_ACCEPTED') {
    return (
      <div className={`flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300 ${className ?? ''}`}>
        <AlertCircle className="w-4 h-4" />
        {t('contractorAgreement.requiredNotSigned', 'Required - not signed')}
      </div>
    )
  }

  if (error || !acceptance) {
    return (
      <div className={`flex items-center gap-2 text-sm text-destructive ${className ?? ''}`}>
        <AlertCircle className="w-4 h-4" />
        {t('contractorAgreement.statusError', 'Unable to verify contractor agreement status')}
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {t('contractorAgreement.signedAgreement', 'Signed Independent Contractor Agreement')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('contractorAgreement.signedVersion', 'Version {{version}} - Signed {{date}}', {
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
