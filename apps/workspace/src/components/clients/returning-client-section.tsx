/**
 * ReturningClientSection - Shows when an existing client is found during new client creation
 * Displays previous engagement history and offers copy-from-previous option
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { UserCheck, Copy, Eye, Loader2 } from 'lucide-react'
import { Modal, ModalHeader, ModalTitle, ModalDescription, Button } from '@ella/ui'
import { api, type EngagementCopyPreview } from '../../lib/api-client'

interface ReturningClientSectionProps {
  client: {
    id: string
    name: string
    phone: string
  }
  selectedTaxYear: number
  onCopyFromPrevious: (engagementId: string | null, shouldCopy: boolean) => void
}

// Status display config
const STATUS_LABEL_KEYS: Record<string, string> = {
  DRAFT: 'engagementStatus.draft',
  ACTIVE: 'engagementStatus.active',
  COMPLETE: 'engagementStatus.complete',
  ARCHIVED: 'engagementStatus.archived',
}

export function ReturningClientSection({
  client,
  selectedTaxYear,
  onCopyFromPrevious,
}: ReturningClientSectionProps) {
  const { t } = useTranslation()
  const [copyFromPrevious, setCopyFromPrevious] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [selectedEngagementId, setSelectedEngagementId] = useState<string | null>(null)

  // Fetch client's engagements
  const { data, isLoading } = useQuery({
    queryKey: ['engagements', client.id],
    queryFn: () => api.engagements.list({ clientId: client.id, limit: 10 }),
  })

  const engagements = data?.data ?? []
  const latestEngagement = engagements[0]

  // Check if engagement already exists for selected year
  const existingEngagement = engagements.find((e) => e.taxYear === selectedTaxYear)

  if (isLoading) {
    return (
      <div className="p-4 bg-primary-light rounded-lg border border-primary/30">
        <div className="flex items-center gap-2 text-primary">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">{t('returningClient.checkingHistory')}</span>
        </div>
      </div>
    )
  }

  // Show warning if engagement already exists for this year
  if (existingEngagement) {
    return (
      <div className="p-4 bg-warning-light rounded-lg border border-warning/30">
        <div className="flex items-center gap-2 text-warning-dark">
          <UserCheck className="w-5 h-5" />
          <span className="font-medium">{t('returningClient.existingYearTitle', { year: selectedTaxYear })}</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('returningClient.existingYearDescription', { name: client.name, year: selectedTaxYear })}
        </p>
      </div>
    )
  }

  const handleCopyChange = (checked: boolean) => {
    setCopyFromPrevious(checked)
    if (checked && latestEngagement) {
      setSelectedEngagementId(latestEngagement.id)
      onCopyFromPrevious(latestEngagement.id, true)
    } else {
      setSelectedEngagementId(null)
      onCopyFromPrevious(null, false)
    }
  }

  return (
    <div className="p-4 bg-primary-light rounded-lg border border-primary/30">
      <div className="flex items-center gap-2 text-primary mb-3">
        <UserCheck className="w-5 h-5" />
        <span className="font-medium">{t('returningClient.title')}</span>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        <strong>{client.name}</strong> {t('returningClient.previousClientDescription')}
        {engagements.length > 0 && (
          <span> {t('returningClient.taxYearsInSystem', { count: engagements.length })}</span>
        )}
      </p>

      {/* Previous engagements list */}
      {engagements.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">{t('returningClient.taxHistory')}</p>
          <div className="space-y-1">
            {engagements.slice(0, 3).map((eng) => (
              <div
                key={eng.id}
                className="flex items-center justify-between px-3 py-2 bg-background rounded border border-border text-sm"
              >
                <span className="font-medium">{eng.taxYear}</span>
                <span className="text-muted-foreground">
                  {eng.filingStatus || t('returningClient.noFilingInfo')} • {STATUS_LABEL_KEYS[eng.status] ? t(STATUS_LABEL_KEYS[eng.status]) : eng.status}
                </span>
              </div>
            ))}
            {engagements.length > 3 && (
              <p className="text-xs text-muted-foreground text-center py-1">
                {t('returningClient.moreYears', { count: engagements.length - 3 })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Copy from previous option */}
      {latestEngagement && (
        <div className="border-t border-primary/20 pt-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={copyFromPrevious}
              onChange={(e) => handleCopyChange(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-foreground flex items-center gap-2">
                <Copy className="w-4 h-4" />
                {t('returningClient.copyFromYear', { year: latestEngagement.taxYear })}
              </span>
              <p className="text-xs text-muted-foreground mt-1">
                {t('returningClient.copyDescription')}
              </p>
            </div>
          </label>

          {copyFromPrevious && (
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="mt-3 flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Eye className="w-4 h-4" />
              {t('returningClient.previewCopy')}
            </button>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && selectedEngagementId && (
        <CopyPreviewModal
          engagementId={selectedEngagementId}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}

// Copy preview modal
interface CopyPreviewModalProps {
  engagementId: string
  onClose: () => void
}

function CopyPreviewModal({ engagementId, onClose }: CopyPreviewModalProps) {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: ['engagement-copy-preview', engagementId],
    queryFn: () => api.engagements.copyPreview(engagementId),
  })

  const preview = data?.data

  return (
    <Modal open onClose={onClose}>
      <ModalHeader>
        <ModalTitle>{t('returningClient.previewTitle')}</ModalTitle>
        <ModalDescription>
          {t('returningClient.previewDescription')}
        </ModalDescription>
      </ModalHeader>

      <div className="p-4 max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : preview ? (
          <PreviewContent preview={preview} />
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('common.noData')}
          </p>
        )}
      </div>

      <div className="p-4 border-t border-border">
        <Button onClick={onClose} className="w-full">
          {t('common.close')}
        </Button>
      </div>
    </Modal>
  )
}

function PreviewContent({ preview }: { preview: EngagementCopyPreview }) {
  const { t } = useTranslation()
  const fields = [
    { key: 'filingStatus', label: t('returningClient.preview.filingStatus'), value: preview.filingStatus },
    { key: 'hasW2', label: t('returningClient.preview.hasW2'), value: preview.hasW2 ? t('common.yes') : t('common.no') },
    { key: 'hasSelfEmployment', label: t('returningClient.preview.hasSelfEmployment'), value: preview.hasSelfEmployment ? t('common.yes') : t('common.no') },
    { key: 'hasRentalProperty', label: t('returningClient.preview.hasRentalProperty'), value: preview.hasRentalProperty ? t('common.yes') : t('common.no') },
    { key: 'hasInvestments', label: t('returningClient.preview.hasInvestments'), value: preview.hasInvestments ? t('common.yes') : t('common.no') },
    { key: 'hasKidsUnder17', label: t('returningClient.preview.hasKidsUnder17'), value: preview.hasKidsUnder17 ? t('common.yes') : t('common.no') },
    { key: 'numKidsUnder17', label: t('returningClient.preview.numKidsUnder17'), value: preview.numKidsUnder17?.toString() ?? '0' },
  ].filter((f) => f.value !== null && f.value !== undefined && f.value !== '0' && f.value !== t('common.no'))

  if (fields.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        {t('returningClient.noCopyInfo')}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {fields.map((field) => (
        <div
          key={field.key}
          className="flex items-center justify-between py-2 border-b border-border last:border-0"
        >
          <span className="text-sm text-muted-foreground">{field.label}</span>
          <span className="text-sm font-medium text-foreground">{field.value}</span>
        </div>
      ))}
    </div>
  )
}
