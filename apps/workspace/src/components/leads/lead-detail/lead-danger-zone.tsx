/**
 * Lead danger zone — delete button + portal confirmation modal.
 */
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Trash2 } from 'lucide-react'
import { api } from '../../../lib/api-client'
import { CardSection } from '../../shared/card-section'
import type { Lead } from '../../../lib/api-client'

interface Props {
  lead: Lead
}

export function LeadDangerZone({ lead }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: () => api.leads.delete(lead.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      navigate({ to: '/leads' })
    },
    onError: () => setError(t('leads.deleteError')),
  })

  // Converted leads use a stronger confirmation copy that calls out what gets removed
  // (messages + SMS history) vs preserved (linked Client and signed NDAs).
  const confirmKey = lead.status === 'CONVERTED' ? 'leads.deleteConvertedConfirm' : 'leads.deleteConfirm'

  return (
    <CardSection tone="destructive" title={t('leads.actions')}>
      {error && (
        <div className="mb-3 p-2 rounded-lg bg-destructive/10 text-destructive text-xs">{error}</div>
      )}
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-medium text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/10 transition-colors flex items-center gap-2"
      >
        <Trash2 className="w-4 h-4" />
        {t('leads.deleteLead')}
      </button>

      {open && createPortal(
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[10000]"
            onClick={() => !deleteMutation.isPending && setOpen(false)}
          />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[10001] w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-destructive/10">
                <Trash2 className="w-6 h-6 text-destructive" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground">{t('leads.deleteLead')}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t(confirmKey)}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setOpen(false)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('common.delete')}
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </CardSection>
  )
}
