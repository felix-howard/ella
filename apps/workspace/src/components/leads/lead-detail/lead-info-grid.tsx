/**
 * Lead sidebar cards — Change Status + Tags management.
 * (Contact info and Source now live in the header card to match client detail.)
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Lock, X } from 'lucide-react'
import { cn } from '@ella/ui'
import { api } from '../../../lib/api-client'
import { CardSection } from '../../shared/card-section'
import { LeadStatusBadge } from '../lead-status-badge'
import type { Lead, LeadStatus } from '../../../lib/api-client'

const STATUS_DOT: Record<LeadStatus, string> = {
  NEW: 'bg-blue-500',
  SENT: 'bg-purple-500',
  CONTACTED: 'bg-amber-500',
  CONVERTED: 'bg-green-500',
  LOST: 'bg-gray-400',
}

const STATUS_RING: Record<LeadStatus, string> = {
  NEW: 'ring-blue-100',
  SENT: 'ring-purple-100',
  CONTACTED: 'ring-amber-100',
  CONVERTED: 'ring-green-100',
  LOST: 'ring-gray-100',
}

const STATUS_ACTIVE: Record<LeadStatus, string> = {
  NEW: 'border-blue-200 bg-blue-50/70',
  SENT: 'border-purple-200 bg-purple-50/70',
  CONTACTED: 'border-amber-200 bg-amber-50/70',
  CONVERTED: 'border-green-200 bg-green-50/70',
  LOST: 'border-gray-200 bg-gray-50/70',
}

interface Props {
  lead: Lead
}

export function LeadInfoGrid({ lead }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const isConverted = lead.status === 'CONVERTED'

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['lead', lead.id] })
    queryClient.invalidateQueries({ queryKey: ['leads'] })
    queryClient.invalidateQueries({ queryKey: ['lead-tags'] })
  }

  const statusMutation = useMutation({
    mutationFn: (status: LeadStatus) => api.leads.update(lead.id, { status }),
    onMutate: async (status) => {
      await queryClient.cancelQueries({ queryKey: ['lead', lead.id] })
      const previous = queryClient.getQueryData(['lead', lead.id])
      queryClient.setQueryData(['lead', lead.id], (old: { data: Lead } | undefined) =>
        old ? { ...old, data: { ...old.data, status } } : old,
      )
      queryClient.setQueriesData({ queryKey: ['leads'] }, (old: { data: Lead[] } | undefined) => {
        if (!old?.data) return old
        return { ...old, data: old.data.map((l) => (l.id === lead.id ? { ...l, status } : l)) }
      })
      setError(null)
      return { previous }
    },
    onError: (_err, _status, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['lead', lead.id], ctx.previous)
      setError(t('leads.updateError'))
    },
    onSettled: invalidate,
  })

  const tagMutation = useMutation({
    mutationFn: (tags: string[]) => api.leads.update(lead.id, { tags }),
    onSuccess: () => {
      setError(null)
      invalidate()
    },
    onError: () => setError(t('leads.updateError')),
  })

  const handleStatusChange = (status: LeadStatus) => {
    if (!status || lead.status === status) return
    statusMutation.mutate(status)
  }

  const handleRemoveTag = (tag: string) => {
    const tags = (lead.tags ?? []).filter((existing) => existing !== tag)
    tagMutation.mutate(tags)
  }

  const statusOptions: { value: LeadStatus; label: string }[] = [
    { value: 'NEW', label: t('leads.status.NEW') },
    { value: 'SENT', label: t('leads.status.SENT') },
    { value: 'CONTACTED', label: t('leads.status.CONTACTED') },
    { value: 'LOST', label: t('leads.status.LOST') },
  ]

  const pendingStatus = statusMutation.isPending ? statusMutation.variables : null

  const customTags = (lead.tags ?? []).filter((tag) => tag !== lead.campaignTag)

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Change Status */}
      <CardSection title={t('leads.changeStatus')}>
        {isConverted ? (
          <div className="flex items-center gap-2.5 rounded-lg border border-green-200 bg-green-50/70 px-3 py-2.5">
            <Lock className="h-3.5 w-3.5 text-green-700" />
            <LeadStatusBadge status="CONVERTED" />
            <span className="ml-auto text-xs text-muted-foreground">
              {t('leads.statusLocked', 'Locked')}
            </span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {statusOptions.map((opt) => {
              const active = lead.status === opt.value
              const loading = pendingStatus === opt.value
              const disabled = statusMutation.isPending && !loading
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleStatusChange(opt.value)}
                  disabled={statusMutation.isPending}
                  aria-pressed={active}
                  className={cn(
                    'group relative flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-all',
                    active
                      ? cn(STATUS_ACTIVE[opt.value], 'shadow-sm')
                      : 'border-border/60 bg-card hover:border-border hover:bg-muted/50',
                    disabled && 'pointer-events-none opacity-50',
                    loading && 'cursor-wait',
                  )}
                >
                  <span
                    className={cn(
                      'h-2.5 w-2.5 flex-shrink-0 rounded-full transition-all',
                      STATUS_DOT[opt.value],
                      active && cn('ring-4', STATUS_RING[opt.value]),
                    )}
                    aria-hidden="true"
                  />
                  <span
                    className={cn(
                      'flex-1 text-left',
                      active ? 'font-semibold text-foreground' : 'text-foreground/80 group-hover:text-foreground',
                    )}
                  >
                    {opt.label}
                  </span>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : active ? (
                    <Check className="h-4 w-4 text-foreground/70" />
                  ) : null}
                </button>
              )
            })}
          </div>
        )}
      </CardSection>

      {/* Tags */}
      <CardSection title={t('leads.tags')}>
        {customTags.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t('leads.tagsEmpty', '—')}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {customTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground"
              >
                {tag}
                {!isConverted && (
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="opacity-60 hover:opacity-100 transition-opacity"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
      </CardSection>
    </div>
  )
}
