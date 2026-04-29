/**
 * Schedule C Link-Existing Modal — appears when CPA links a Schedule-C-eligible
 * business (Sole Prop / SMLLC) to an individual that already owns a Schedule C
 * for the same tax year. Three actions:
 *   1. "Yes" → reassign existing Schedule C to the new business's TaxCase.
 *   2. "No" / "Skip" → close, no API call (new business will lazily create its
 *      own empty Schedule C on first Send).
 */
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, X } from 'lucide-react'
import { Button } from '@ella/ui'
import { useScheduleCReassign } from '../../hooks/use-schedule-c-reassign'
import { localizedReassignError } from '../../lib/schedule-c-reassign-errors'
import { toast } from '../../stores/toast-store'

interface ScheduleCLinkExistingModalProps {
  open: boolean
  scheduleCId: string
  individualName: string
  businessName: string
  newBusinessCaseId: string
  onResolved: () => void
  onClose: () => void
}

export function ScheduleCLinkExistingModal({
  open,
  scheduleCId,
  individualName,
  businessName,
  newBusinessCaseId,
  onResolved,
  onClose: _onClose,
}: ScheduleCLinkExistingModalProps) {
  const { t } = useTranslation()
  const reassign = useScheduleCReassign()

  const handleSkip = useCallback(() => {
    if (reassign.isPending) return
    onResolved()
  }, [reassign.isPending, onResolved])

  useEffect(() => {
    if (!open) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkip()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, handleSkip])

  if (!open) return null

  const handleLink = () => {
    if (reassign.isPending) return
    reassign.mutate(
      { scheduleCId, targetCaseId: newBusinessCaseId },
      {
        onSuccess: () => {
          toast.success(t('scheduleC.linkExisting.linkedToast', { businessName }))
          onResolved()
        },
        onError: (err) => {
          toast.error(localizedReassignError(err, t, 'scheduleC.linkExisting.errorToast'))
        },
      }
    )
  }

  const handleSeparate = () => {
    if (reassign.isPending) return
    onResolved()
  }

  const handleOverlay = () => {
    if (!reassign.isPending) handleSkip()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={handleOverlay}
      role="dialog"
      aria-modal="true"
      aria-label={t('scheduleC.linkExisting.title')}
    >
      <div
        className="bg-card rounded-2xl shadow-lg w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">
            {t('scheduleC.linkExisting.title')}
          </h2>
          <button
            type="button"
            onClick={handleSkip}
            disabled={reassign.isPending}
            className="p-1 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
            aria-label={t('common.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-5">
          {t('scheduleC.linkExisting.body', { individualName, businessName })}
        </p>

        {reassign.isError && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs">
            {localizedReassignError(reassign.error, t, 'scheduleC.linkExisting.errorToast')}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            onClick={handleLink}
            disabled={reassign.isPending}
            className="w-full"
          >
            {reassign.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {t('scheduleC.linkExisting.linkButton', { businessName })}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleSeparate}
            disabled={reassign.isPending}
            className="w-full"
          >
            {t('scheduleC.linkExisting.separateButton')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleSkip}
            disabled={reassign.isPending}
            className="w-full"
          >
            {t('scheduleC.linkExisting.skipButton')}
          </Button>
        </div>
      </div>
    </div>
  )
}
