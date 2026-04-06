/**
 * Schedule E Actions - Unlock button and compact form link with copy
 */
import { useState } from 'react'
import { Unlock, Loader2, ExternalLink, Copy, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@ella/ui'
import type { ScheduleEStatus } from '../../../../lib/api-client'
import { useScheduleEActions } from '../../../../hooks/use-schedule-e-actions'
import { toast } from '../../../../stores/toast-store'

interface ScheduleEActionsProps {
  caseId: string
  status: ScheduleEStatus
  magicLinkUrl?: string | null
}

export function ScheduleEActions({ caseId, status, magicLinkUrl }: ScheduleEActionsProps) {
  const { t } = useTranslation()
  const { unlock, isLoading } = useScheduleEActions({ caseId })
  const [copied, setCopied] = useState(false)

  const isLocked = status === 'LOCKED'
  const formLink = magicLinkUrl ?? null

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!formLink) return
    try {
      await navigator.clipboard.writeText(formLink)
      setCopied(true)
      toast.success(t('common.linkCopied'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('common.copyFailed'))
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Unlock Button - only when locked */}
      {isLocked && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => unlock.mutate()}
          disabled={isLoading}
          className="gap-2"
          aria-label={t('scheduleE.unlockButton')}
        >
          {unlock.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Unlock className="w-4 h-4" aria-hidden="true" />
          )}
          {t('scheduleE.unlockButton')}
        </Button>
      )}

      {/* Form Link - compact: open link + copy icon */}
      {!isLocked && formLink && (
        <div className="flex items-center gap-1">
          <a
            href={formLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            {t('common.openLink')}
          </a>
          <button
            type="button"
            onClick={handleCopyLink}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label={t('common.copyLink')}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
            ) : (
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>
        </div>
      )}
    </div>
  )
}
