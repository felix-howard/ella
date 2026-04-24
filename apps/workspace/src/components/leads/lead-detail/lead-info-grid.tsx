/**
 * Info grid: 4 cards (Contact, Status, Source, Tags) — responsive 1/2/4 columns.
 * Each card is small enough to stay inline in this file (<200 LOC total).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Calendar, Globe, Mail, Phone, X } from 'lucide-react'
import { api } from '../../../lib/api-client'
import { formatPhone, formatShortRelativeTime } from '../../../lib/formatters'
import { CustomSelect, type SelectOption } from '../../ui/custom-select'
import { LeadStatusBadge } from '../lead-status-badge'
import type { Lead, LeadStatus } from '../../../lib/api-client'

interface Props {
  lead: Lead
}

export function LeadInfoGrid({ lead }: Props) {
  const { t, i18n } = useTranslation()
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
        old ? { ...old, data: { ...old.data, status } } : old
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
    onSuccess: () => { setError(null); invalidate() },
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

  const statusOptions: SelectOption[] = [
    { value: 'NEW', label: t('leads.status.NEW') },
    { value: 'SENT', label: t('leads.status.SENT') },
    { value: 'CONTACTED', label: t('leads.status.CONTACTED') },
    { value: 'LOST', label: t('leads.status.LOST') },
  ]

  const customTags = (lead.tags ?? []).filter((tag) => tag !== lead.campaignTag)

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* Contact */}
      <Card title={t('leads.contactInfo')}>
        <InfoRow icon={Phone} label={t('leads.phone')} value={formatPhone(lead.phone)} />
        <InfoRow icon={Mail} label={t('leads.email')} value={lead.email || '—'} />
        <InfoRow icon={Building2} label={t('leads.business')} value={lead.businessName || '—'} />
        <InfoRow
          icon={Calendar}
          label={t('leads.created')}
          value={formatShortRelativeTime(lead.createdAt, i18n.language)}
        />
      </Card>

      {/* Status */}
      <Card title={t('leads.changeStatus')}>
        <div className="flex items-center gap-2 mb-3">
          <LeadStatusBadge status={lead.status} />
        </div>
        {!isConverted && (
          <CustomSelect
            value={lead.status}
            onChange={(s) => handleStatusChange(s as LeadStatus)}
            options={statusOptions}
            disabled={statusMutation.isPending}
            className="w-full"
          />
        )}
      </Card>

      {/* Source */}
      <Card title={t('leads.source')}>
        <InfoRow
          icon={Globe}
          label={t('leads.campaignTagLabel')}
          value={lead.campaignName || lead.campaignTag || '—'}
        />
        {lead.campaignTag && (
          <div className="mt-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              {lead.campaignTag}
            </span>
          </div>
        )}
      </Card>

      {/* Tags */}
      <Card title={t('leads.tags')}>
        {customTags.length === 0 ? (
          <p className="text-xs text-muted-foreground">—</p>
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
      </Card>
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="px-4 py-3 border-b border-border/40">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="p-4 space-y-2">{children}</div>
    </section>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
      <span className="text-sm text-foreground truncate">{value}</span>
    </div>
  )
}
