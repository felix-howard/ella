/** Dedicated modal for updating an Agreement's deposit lifecycle. */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalTitle, ModalDescription, ModalFooter, cn } from '@ella/ui'
import { CheckCircle2, Clock3, Loader2, RotateCcw, ShieldX, type LucideIcon } from 'lucide-react'
import { DepositStatusBadge } from './agreement-status-badges'
import { useUpdateDeposit } from './use-agreement-mutations'
import { formatFullDateTime } from '../../lib/formatters'
import { DepositPaidAtPicker } from './deposit-paid-at-picker'
import type { Agreement, NdaDepositStatus } from '../../lib/api-client'
import type { EntityRef } from './types'

const ALLOWED: Record<NdaDepositStatus, readonly NdaDepositStatus[]> = { PENDING: ['PENDING', 'PAID', 'FORFEITED'], PAID: ['PAID', 'REFUNDED'], REFUNDED: ['REFUNDED'], FORFEITED: ['FORFEITED'] }
const STATUS_ICON: Record<NdaDepositStatus, LucideIcon> = { PENDING: Clock3, PAID: CheckCircle2, REFUNDED: RotateCcw, FORFEITED: ShieldX }

const STATUS_TONE: Record<NdaDepositStatus, string> = {
  PENDING: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
  PAID: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
  REFUNDED: 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100',
  FORFEITED: 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100',
}

function toLocalInputValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDepositAmount(amount: string | null): string {
  if (!amount) return '-'
  return amount.trim().startsWith('$') ? amount : `$${amount}`
}

interface Props {
  entity: EntityRef
  nda: Agreement & { depositStatus: NdaDepositStatus }
  onClose: () => void
}

export function UpdateDepositPanel({ entity, nda, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const mutation = useUpdateDeposit(entity)

  const originalPaidAt = toLocalInputValue(nda.depositPaidAt)
  const [status, setStatus] = useState<NdaDepositStatus>(nda.depositStatus)
  const [note, setNote] = useState<string>(nda.depositNote ?? '')
  const [paidAt, setPaidAt] = useState<string>(originalPaidAt)

  const options = ALLOWED[nda.depositStatus]

  const resolvePaidAtIso = (): string | null => {
    if (status !== 'PAID') return null
    if (paidAt === originalPaidAt && nda.depositPaidAt) return nda.depositPaidAt
    if (paidAt) return new Date(paidAt).toISOString()
    return new Date().toISOString()
  }

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault()
    mutation.mutate(
      {
        agreementId: nda.id,
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
  const paidAtHelp = nda.depositPaidAt
    ? t('nda.deposit.paidAtExisting', { date: formatFullDateTime(nda.depositPaidAt) })
    : t('nda.deposit.paidAtHint')

  return (
    <Modal open onClose={onClose} size="lg" closeOnOverlayClick={!mutation.isPending}
      closeOnEscape={!mutation.isPending} aria-labelledby="update-deposit-title"
      aria-describedby="update-deposit-description" className="flex flex-col overflow-hidden p-0">
      <form onSubmit={handleSave} className="flex max-h-[90vh] min-h-0 flex-col">
        <div className="shrink-0 bg-muted/30 px-6 py-5 border-b border-border">
          <ModalHeader className="mb-0 pr-8">
            <ModalTitle id="update-deposit-title" className="text-foreground">{t('nda.deposit.modalTitle')}</ModalTitle>
            <ModalDescription id="update-deposit-description">
              {t('nda.deposit.modalDescription')}
            </ModalDescription>
          </ModalHeader>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="max-w-full truncate font-semibold text-foreground" title={nda.title}>
              {nda.title}
            </span>
            <span className="rounded-full border border-border bg-card px-2.5 py-1 font-medium">
              {formatDepositAmount(nda.depositAmount)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-muted-foreground">{t('nda.deposit.currentStatusLabel')}:</span>
              <DepositStatusBadge status={nda.depositStatus} />
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <section>
            <h3 className="text-sm font-semibold text-foreground mb-2">{t('nda.deposit.nextStatusLabel')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {options.map((option) => {
                const Icon = STATUS_ICON[option]
                const active = status === option
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setStatus(option)}
                    disabled={mutation.isPending}
                    aria-pressed={active}
                    className={cn(
                      'min-h-16 rounded-lg border p-3 text-left transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50',
                      active ? STATUS_TONE[option] : 'border-border bg-background hover:bg-muted',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-sm font-semibold">{t(`nda.deposit.${option}`)}</div>
                        <div className="text-xs opacity-80">{t(`nda.deposit.statusHint.${option}`)}</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {status === 'PAID' && (
            <section>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t('nda.deposit.paidAtLabel')}
              </label>
              <DepositPaidAtPicker
                value={paidAt}
                onChange={setPaidAt}
                disabled={mutation.isPending}
                locale={i18n.language || 'en-US'}
                dateLabel={t('nda.deposit.dateLabel')}
                timeLabel={t('nda.deposit.timeLabel')}
                placeholder={t('nda.deposit.dateTimePlaceholder')}
                nowLabel={t('nda.deposit.useNow')}
                clearLabel={t('nda.deposit.clearPaidAt')}
              />
              <p className="text-xs text-muted-foreground mt-1.5">{paidAtHelp}</p>
            </section>
          )}

          <section>
            <label className="block text-sm font-medium text-foreground mb-1.5">{t('nda.deposit.noteLabel')}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              maxLength={1000}
              disabled={mutation.isPending}
              placeholder={t('nda.deposit.notePlaceholder')}
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <div className="text-right text-xs text-muted-foreground mt-1">{note.length}/1000</div>
          </section>
        </div>

        <ModalFooter className="mt-0 shrink-0 px-6 py-4 bg-muted/20">
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={mutation.isPending || isNoop}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('nda.deposit.saveCta')}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
