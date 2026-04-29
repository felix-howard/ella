/**
 * Business Delete With Schedule C Modal — appears when a CPA tries to delete
 * a BUSINESS client that owns a Schedule C. Surfaces the magnitude of the data
 * being lost (expense count + dollar total) so the destructive choice is
 * deliberate.
 *
 * Phase 8 of the Schedule C business-entity redesign. See
 * plans/260428-1409-schedule-c-business-entity-redesign/phase-08-business-delete-with-schedule-c.md.
 */
import { useCallback, useEffect } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { Loader2, X, Trash2 } from 'lucide-react'
import { Button } from '@ella/ui'

interface BusinessDeleteWithScheduleCModalProps {
  open: boolean
  businessName: string
  expenseCount: number
  totalDollars: string
  isPending: boolean
  onConfirm: () => void
  onCancel: () => void
}

function formatDollars(amount: string): string {
  const n = Number(amount)
  if (!Number.isFinite(n)) return amount
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

export function BusinessDeleteWithScheduleCModal({
  open,
  businessName,
  expenseCount,
  totalDollars,
  isPending,
  onConfirm,
  onCancel,
}: BusinessDeleteWithScheduleCModalProps) {
  const { t } = useTranslation()

  const handleCancel = useCallback(() => {
    if (isPending) return
    onCancel()
  }, [isPending, onCancel])

  useEffect(() => {
    if (!open) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, handleCancel])

  if (!open) return null

  const formattedTotal = formatDollars(totalDollars)

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={handleCancel}
      role="dialog"
      aria-modal="true"
      aria-label={t('clients.deleteBusinessWithSC.title')}
    >
      <div
        className="bg-card rounded-2xl shadow-lg w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-lg font-semibold text-destructive">
            {t('clients.deleteBusinessWithSC.title')}
          </h2>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="p-1 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
            aria-label={t('common.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-5">
          <Trans
            i18nKey="clients.deleteBusinessWithSC.body"
            values={{
              count: expenseCount,
              total: formattedTotal,
              businessName,
            }}
            components={{ strong: <strong className="text-foreground" /> }}
          />
        </p>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isPending}
          >
            {t('clients.deleteBusinessWithSC.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t('clients.deleteBusinessWithSC.deleting')}
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                {t('clients.deleteBusinessWithSC.confirm')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
