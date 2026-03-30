/**
 * Lead Detail Drawer - Right-side 900px drawer showing lead details, notes, status, actions
 */
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X, Phone, Mail, Building2, Globe, Calendar, Save,
  Loader2, Trash2, ArrowRight, MessageSquare,
} from 'lucide-react'
import { cn } from '@ella/ui'
import { api } from '../../lib/api-client'
import { formatPhone, formatShortRelativeTime } from '../../lib/formatters'
import { LeadStatusBadge } from './lead-status-badge'
import type { Lead, LeadStatus } from '../../lib/api-client'

interface LeadDetailDrawerProps {
  lead: Lead | null
  open: boolean
  onClose: () => void
  onConvert: (lead: Lead) => void
}

const LEAD_STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'CONVERTED', 'LOST']

export function LeadDetailDrawer({ lead, open, onClose, onConvert }: LeadDetailDrawerProps) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()

  const [notes, setNotes] = useState('')
  const [notesChanged, setNotesChanged] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Fetch fresh lead data
  const { data: freshLead } = useQuery({
    queryKey: ['lead', lead?.id],
    queryFn: () => api.leads.get(lead!.id),
    enabled: !!lead?.id && open,
    staleTime: 30_000,
  })

  const currentLead = freshLead?.data ?? lead

  // Sync notes and reset state when lead changes
  useEffect(() => {
    if (currentLead) {
      setNotes(currentLead.notes ?? '')
      setNotesChanged(false)
    }
    setShowDeleteConfirm(false)
  }, [currentLead?.id])

  // Handle escape key
  useEffect(() => {
    if (!open) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const [mutationError, setMutationError] = useState<string | null>(null)

  const invalidateLeadQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['leads'] })
    queryClient.invalidateQueries({ queryKey: ['lead', currentLead?.id] })
  }

  // Update status mutation
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.leads.update(id, { status }),
    onSuccess: () => { setMutationError(null); invalidateLeadQueries() },
    onError: () => setMutationError(t('leads.updateError')),
  })

  // Save notes mutation
  const notesMutation = useMutation({
    mutationFn: ({ id, notes: newNotes }: { id: string; notes: string }) =>
      api.leads.update(id, { notes: newNotes || null }),
    onSuccess: () => { setNotesChanged(false); setMutationError(null); invalidateLeadQueries() },
    onError: () => setMutationError(t('leads.updateError')),
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.leads.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leads'] }); onClose() },
    onError: () => setMutationError(t('leads.deleteError')),
  })

  const handleSaveNotes = () => {
    if (!currentLead) return
    notesMutation.mutate({ id: currentLead.id, notes })
  }

  const handleStatusChange = (status: LeadStatus) => {
    if (!currentLead || currentLead.status === status) return
    statusMutation.mutate({ id: currentLead.id, status })
  }

  const isConverted = currentLead?.status === 'CONVERTED'

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity duration-200',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-full max-w-[900px] bg-card shadow-lg transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-label={t('leads.details')}
      >
        {currentLead && (
          <div className="h-full flex flex-col overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-foreground">
                  {currentLead.firstName} {currentLead.lastName}
                </h2>
                <LeadStatusBadge status={currentLead.status} />
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
                aria-label={t('common.close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 px-6 py-5 space-y-6">
              {/* Error Banner */}
              {mutationError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                  {mutationError}
                </div>
              )}

              {/* Contact Info */}
              <section>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  {t('leads.contactInfo')}
                </h3>
                <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                  <InfoRow icon={Phone} label={t('leads.phone')} value={formatPhone(currentLead.phone)} />
                  <InfoRow icon={Mail} label={t('leads.email')} value={currentLead.email || '—'} />
                  <InfoRow icon={Building2} label={t('leads.business')} value={currentLead.businessName || '—'} />
                  <InfoRow icon={Globe} label={t('leads.source')} value={currentLead.source || '—'} />
                  <InfoRow
                    icon={Calendar}
                    label={t('leads.created')}
                    value={formatShortRelativeTime(currentLead.createdAt, i18n.language)}
                  />
                </div>
              </section>

              {/* Status */}
              {!isConverted && (
                <section>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    {t('leads.changeStatus')}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {LEAD_STATUSES.filter(s => s !== 'CONVERTED').map((status) => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(status)}
                        disabled={statusMutation.isPending}
                        className={cn(
                          'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                          currentLead.status === status
                            ? 'bg-primary text-white'
                            : 'bg-muted text-foreground hover:bg-muted/80'
                        )}
                      >
                        {t(`leads.status.${status}`)}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Notes */}
              <section>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  {t('leads.editNotes')}
                </h3>
                <textarea
                  value={notes}
                  onChange={(e) => { setNotes(e.target.value); setNotesChanged(true) }}
                  rows={4}
                  placeholder={t('leads.notesPlaceholder')}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                {notesChanged && (
                  <button
                    onClick={handleSaveNotes}
                    disabled={notesMutation.isPending}
                    className="mt-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
                  >
                    {notesMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {t('leads.saveNotes')}
                  </button>
                )}
              </section>

              {/* Actions */}
              <section>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  {t('leads.actions')}
                </h3>
                <div className="flex flex-wrap gap-3">
                  {isConverted && currentLead.convertedToId ? (
                    <Link
                      to="/clients/$clientId"
                      params={{ clientId: currentLead.convertedToId }}
                      className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                      {t('leads.viewClient')}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  ) : !isConverted ? (
                    <button
                      onClick={() => onConvert(currentLead)}
                      className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                      <ArrowRight className="w-4 h-4" />
                      {t('leads.convert')}
                    </button>
                  ) : null}

                  {!isConverted && (
                    <>
                      {showDeleteConfirm ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-destructive">{t('leads.deleteConfirm')}</span>
                          <button
                            onClick={() => deleteMutation.mutate(currentLead.id)}
                            disabled={deleteMutation.isPending}
                            className="px-3 py-1.5 text-sm font-medium text-white bg-destructive rounded-lg hover:bg-destructive/90 transition-colors"
                          >
                            {deleteMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : t('common.confirm')}
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="px-4 py-2 text-sm font-medium text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/10 transition-colors flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          {t('leads.deleteLead')}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </section>

              {/* Message History Placeholder */}
              <section>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  {t('leads.messageHistory')}
                </h3>
                <div className="bg-muted/30 rounded-lg p-6 text-center">
                  <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t('leads.noMessages')}</p>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="text-sm text-muted-foreground w-20 shrink-0">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  )
}
