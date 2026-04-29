/**
 * Schedule C Reassign Modal — manual picker for moving a Schedule C between
 * sibling clients in the same group. Only same-tax-year targets are listed
 * (locked Q3 — cross-year reassign blocked). Targets that already own a SC
 * are visible-but-disabled.
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, X } from 'lucide-react'
import { Button } from '@ella/ui'
import type { ClientGroup } from '../../../../lib/api-client'
import { useScheduleCReassign } from '../../../../hooks/use-schedule-c-reassign'
import { isScheduleCEligibleBusiness } from '../../../../lib/business-type-helpers'
import { localizedReassignError } from '../../../../lib/schedule-c-reassign-errors'
import { toast } from '../../../../stores/toast-store'
import {
  ScheduleCReassignTargetRow,
  type ScheduleCReassignTarget,
} from './schedule-c-reassign-target-row'

interface ScheduleCReassignModalProps {
  open: boolean
  scheduleCId: string
  currentClientId: string
  sourceTaxYear: number
  clientGroup: ClientGroup | null
  onClose: () => void
}

// Note: sibling preview exposes `latestCaseTaxYear` only — siblings whose
// most recent case is a different year won't surface here even if an older
// matching-year case exists. Backend reassign endpoint rejects cross-year
// requests defensively, so this is a UI-coverage limitation, not a safety hole.
export function buildReassignTargets(
  clientGroup: ClientGroup | null,
  currentClientId: string,
  sourceTaxYear: number,
): ScheduleCReassignTarget[] {
  if (!clientGroup) return []
  return clientGroup.clients
    .filter((c) => c.id !== currentClientId)
    .filter((c) => c.clientType === 'INDIVIDUAL' || isScheduleCEligibleBusiness(c))
    .filter((c) => c.latestCaseTaxYear === sourceTaxYear && c.latestCaseId != null)
    .map((c) => ({
      clientId: c.id,
      name: c.name,
      clientType: c.clientType,
      businessType: c.businessType ?? null,
      targetCaseId: c.latestCaseId as string,
      hasSC: c.scheduleCExpense != null,
    }))
}

export function ScheduleCReassignModal({
  open,
  scheduleCId,
  currentClientId,
  sourceTaxYear,
  clientGroup,
  onClose,
}: ScheduleCReassignModalProps) {
  const { t } = useTranslation()
  const reassign = useScheduleCReassign()
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)

  const targets = useMemo(
    () => buildReassignTargets(clientGroup, currentClientId, sourceTaxYear),
    [clientGroup, currentClientId, sourceTaxYear],
  )

  const handleClose = () => {
    if (reassign.isPending) return
    setSelectedCaseId(null)
    onClose()
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !reassign.isPending) handleClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reassign.isPending])

  if (!open) return null

  const handleMove = () => {
    if (!selectedCaseId || reassign.isPending) return
    reassign.mutate(
      { scheduleCId, targetCaseId: selectedCaseId },
      {
        onSuccess: () => {
          toast.success(t('scheduleC.reassign.successToast'))
          setSelectedCaseId(null)
          onClose()
        },
        onError: (err) => {
          toast.error(localizedReassignError(err, t, 'scheduleC.reassign.errorToast'))
        },
      },
    )
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('scheduleC.reassign.title')}
    >
      <div
        className="bg-card rounded-2xl shadow-lg w-full max-w-md p-6 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {t('scheduleC.reassign.title')}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {t('scheduleC.reassign.subtitle', { taxYear: sourceTaxYear })}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={reassign.isPending}
            className="p-1 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
            aria-label={t('common.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {targets.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-6 text-center">
              {t('scheduleC.reassign.noTargets')}
            </p>
          ) : (
            <div className="space-y-2" role="radiogroup" aria-label={t('scheduleC.reassign.title')}>
              {targets.map((target) => (
                <ScheduleCReassignTargetRow
                  key={target.clientId}
                  target={target}
                  selected={selectedCaseId === target.targetCaseId}
                  disabled={reassign.isPending}
                  onSelect={setSelectedCaseId}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={reassign.isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleMove}
            disabled={!selectedCaseId || reassign.isPending}
          >
            {reassign.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {t('scheduleC.reassign.moveButton')}
          </Button>
        </div>
      </div>
    </div>
  )
}
