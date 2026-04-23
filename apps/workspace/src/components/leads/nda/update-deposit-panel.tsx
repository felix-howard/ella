/**
 * Inline editor for updating an NDA's deposit status.
 * Mirrors server transition whitelist so invalid options are hidden client-side.
 * PAID → optional paidAt datetime. All statuses support a note.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { CustomSelect, type SelectOption } from '../../ui/custom-select'
import { useUpdateDeposit } from './use-nda-mutations'
import type { NdaAgreement, NdaDepositStatus } from '../../../lib/api-client'

const ALLOWED: Record<NdaDepositStatus, readonly NdaDepositStatus[]> = {
  PENDING: ['PENDING', 'PAID', 'FORFEITED'],
  PAID: ['PAID', 'REFUNDED'],
  REFUNDED: ['REFUNDED'],
  FORFEITED: ['FORFEITED'],
}

function toLocalInputValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface Props {
  leadId: string
  nda: NdaAgreement
  onClose: () => void
}

export function UpdateDepositPanel({ leadId, nda, onClose }: Props) {
  const { t } = useTranslation()
  const mutation = useUpdateDeposit(leadId)

  const originalPaidAt = toLocalInputValue(nda.depositPaidAt)
  const [status, setStatus] = useState<NdaDepositStatus>(nda.depositStatus)
  const [note, setNote] = useState<string>(nda.depositNote ?? '')
  const [paidAt, setPaidAt] = useState<string>(originalPaidAt)

  const options: SelectOption[] = ALLOWED[nda.depositStatus].map((s) => ({
    value: s,
    label: t(`nda.deposit.${s}`),
  }))

  const resolvePaidAtIso = (): string | null => {
    if (status !== 'PAID') return null
    // If the input wasn't changed and there's already an ISO, preserve it verbatim to avoid
    // datetime-local minute-precision rewrites dropping seconds/ms.
    if (paidAt === originalPaidAt && nda.depositPaidAt) return nda.depositPaidAt
    if (paidAt) return new Date(paidAt).toISOString()
    // Moving INTO PAID with no timestamp entered — default to now.
    return new Date().toISOString()
  }

  const handleSave = () => {
    mutation.mutate(
      {
        ndaId: nda.id,
        depositStatus: status,
        depositNote: note.trim() ? note.trim() : null,
        depositPaidAt: resolvePaidAtIso(),
      },
      { onSuccess: () => onClose() },
    )
  }

  const noteUnchanged = note.trim() === (nda.depositNote ?? '').trim()
  const paidAtUnchanged = paidAt === originalPaidAt
  const isNoop = status === nda.depositStatus && noteUnchanged && paidAtUnchanged

  return (
    <div className="mt-3 p-3 rounded-lg border border-border/60 bg-muted/20 space-y-3">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          {t('nda.deposit.statusLabel')}
        </label>
        <CustomSelect
          value={status}
          onChange={(v) => setStatus(v as NdaDepositStatus)}
          options={options}
          disabled={mutation.isPending}
          className="max-w-xs"
        />
      </div>

      {status === 'PAID' && (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            {t('nda.deposit.paidAtLabel')}
          </label>
          <input
            type="datetime-local"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            disabled={mutation.isPending}
            className="w-full max-w-xs px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          {t('nda.deposit.noteLabel')}
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={1000}
          disabled={mutation.isPending}
          placeholder={t('nda.deposit.notePlaceholder')}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={mutation.isPending}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={mutation.isPending || isNoop}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {mutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
          {t('common.save')}
        </button>
      </div>
    </div>
  )
}
