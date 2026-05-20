import { useState } from 'react'
import { CalendarClock, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@ella/ui'
import type { IdentityRetentionExtensionDays } from '../../lib/api-client'
import { IdentityRetentionExtendModal } from '../cases/case-filed-action'

export interface IdentityRetentionSectionNoticeProps {
  scheduledCount?: number
  nextDeletionLabel?: string | null
  canExtend?: boolean
  isExtendPending?: boolean
  onExtend?: (days: IdentityRetentionExtensionDays) => Promise<unknown> | unknown
}

export function IdentityRetentionSectionNotice({
  scheduledCount = 0,
  nextDeletionLabel,
  canExtend = false,
  isExtendPending = false,
  onExtend,
}: IdentityRetentionSectionNoticeProps) {
  const { t } = useTranslation()
  const [isExtendOpen, setIsExtendOpen] = useState(false)
  const hasScheduledDate = scheduledCount > 0 && Boolean(nextDeletionLabel)
  const retentionMessage = hasScheduledDate
    ? t('files.retention.scheduledDate', {
        count: scheduledCount,
        date: nextDeletionLabel,
      })
    : t('files.retention.noticeBody')

  return (
    <div className="flex flex-col gap-3 px-4 py-3 bg-amber-50/70 text-amber-900 dark:bg-amber-950/25 dark:text-amber-200 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2">
        <CalendarClock className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5">{t('files.retention.noticeTitle')}</p>
          <p className="text-xs font-medium leading-5 text-amber-800/80 dark:text-amber-200/80">
            {retentionMessage}
          </p>
        </div>
      </div>

      {canExtend && onExtend && (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsExtendOpen(true)}
            disabled={isExtendPending}
            className="w-full gap-1.5 bg-background/80 sm:w-auto"
          >
            {isExtendPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
            )}
            {t('clientDetail.extendRetention')}
          </Button>
          <IdentityRetentionExtendModal
            open={isExtendOpen}
            isPending={isExtendPending}
            onCancel={() => setIsExtendOpen(false)}
            onExtend={onExtend}
          />
        </>
      )}
    </div>
  )
}
