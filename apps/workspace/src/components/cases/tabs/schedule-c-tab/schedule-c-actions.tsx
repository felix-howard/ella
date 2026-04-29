/**
 * Schedule C Actions - Unlock, form link with copy, and reassign-to-entity action.
 */
import { useState } from 'react'
import { Unlock, Loader2, ExternalLink, Copy, Check, MoveRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, SimpleTooltip } from '@ella/ui'
import type { ClientGroup, ScheduleCStatus } from '../../../../lib/api-client'
import { useScheduleCActions } from '../../../../hooks/use-schedule-c-actions'
import { toast } from '../../../../stores/toast-store'
import {
  ScheduleCReassignModal,
  buildReassignTargets,
} from './schedule-c-reassign-modal'

interface ScheduleCActionsProps {
  caseId: string
  status: ScheduleCStatus
  magicLinkUrl?: string | null
  scheduleCId?: string
  currentClientId?: string
  sourceTaxYear?: number
  clientGroup?: ClientGroup | null
}

export function ScheduleCActions({
  caseId,
  status,
  magicLinkUrl,
  scheduleCId,
  currentClientId,
  sourceTaxYear,
  clientGroup,
}: ScheduleCActionsProps) {
  const { t } = useTranslation()
  const { unlock, isLoading } = useScheduleCActions({ caseId })
  const [copied, setCopied] = useState(false)
  const [reassignOpen, setReassignOpen] = useState(false)

  const isLocked = status === 'LOCKED'
  const formLink = magicLinkUrl ?? null

  const canShowReassign = !!(scheduleCId && currentClientId && sourceTaxYear != null && clientGroup)
  const reassignTargetCount = canShowReassign
    ? buildReassignTargets(clientGroup, currentClientId as string, sourceTaxYear as number).length
    : 0
  const reassignDisabled = reassignTargetCount === 0

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

  const reassignButton = canShowReassign ? (
    <Button
      variant="outline"
      size="sm"
      onClick={() => !reassignDisabled && setReassignOpen(true)}
      disabled={reassignDisabled}
      className="gap-2"
      aria-label={t('scheduleC.reassign.menuItem')}
    >
      <MoveRight className="w-4 h-4" aria-hidden="true" />
      {t('scheduleC.reassign.menuItem')}
    </Button>
  ) : null

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
          aria-label={t('scheduleC.unlockButton')}
        >
          {unlock.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Unlock className="w-4 h-4" aria-hidden="true" />
          )}
          {t('scheduleC.unlockButton')}
        </Button>
      )}

      {/* Reassign — disabled-with-tooltip when no eligible targets */}
      {reassignButton && reassignDisabled && (
        <SimpleTooltip text={t('scheduleC.reassign.disabledTooltip')}>{reassignButton}</SimpleTooltip>
      )}
      {reassignButton && !reassignDisabled && reassignButton}

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

      {canShowReassign && (
        <ScheduleCReassignModal
          open={reassignOpen}
          scheduleCId={scheduleCId as string}
          currentClientId={currentClientId as string}
          sourceTaxYear={sourceTaxYear as number}
          clientGroup={clientGroup ?? null}
          onClose={() => setReassignOpen(false)}
        />
      )}
    </div>
  )
}
