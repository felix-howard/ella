/**
 * Campaigns Tab - List campaign cards with CRUD actions
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Copy, Check, Archive, RotateCcw, Pencil, Trash2, Users, Megaphone, Link as LinkIcon, AlertTriangle } from 'lucide-react'
import { cn } from '@ella/ui'
import { api } from '../../lib/api-client'
import { PORTAL_BASE_URL } from '../../lib/constants'
import { toast } from '../../stores/toast-store'
import { CreateCampaignDialog } from './create-campaign-dialog'
import { EditCampaignDialog } from './edit-campaign-dialog'
import type { Campaign } from '../../lib/api-client'

interface CampaignsTabProps {
  onViewLeads: (tag: string) => void
  orgSlug: string | null
}

export function CampaignsTab({ onViewLeads, orgSlug }: CampaignsTabProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    return () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current) }
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.campaigns.list(),
  })

  const campaigns = data?.data ?? []

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status?: 'ACTIVE' | 'ARCHIVED' } }) =>
      api.campaigns.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success(t('leads.campaignUpdated'))
    },
    onError: () => toast.error(t('leads.updateError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.campaigns.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success(t('leads.campaignDeleted'))
    },
    onError: () => toast.error(t('leads.deleteError')),
  })

  const handleCopyLink = useCallback(async (campaign: Campaign) => {
    if (!orgSlug) return
    const url = `${PORTAL_BASE_URL}/register/${orgSlug}/${campaign.slug}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(campaign.id)
      toast.success(t('leads.copiedLink'))
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error(t('settings.copyFailed'))
    }
  }, [orgSlug, t])

  const handleDelete = useCallback((campaign: Campaign) => {
    if (campaign._count.leads > 0) {
      toast.error(t('leads.campaignCannotDelete'))
      return
    }
    if (confirm(t('leads.campaignDeleteConfirm'))) {
      deleteMutation.mutate(campaign.id)
    }
  }, [deleteMutation, t])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        {t('common.loading')}
      </div>
    )
  }

  return (
    <div>
      {/* Default Registration Link */}
      <DefaultRegistrationCard orgSlug={orgSlug} />

      {/* Header */}
      <div className="flex items-center justify-between mb-4 mt-6">
        <h3 className="text-sm font-medium text-muted-foreground">{t('leads.campaigns')}</h3>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('leads.createCampaign')}
        </button>
      </div>

      {/* Campaign Cards */}
      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Megaphone className="w-10 h-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium text-foreground">{t('leads.noCampaigns')}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('leads.noCampaignsDesc')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              orgSlug={orgSlug}
              copiedId={copiedId}
              onCopyLink={() => handleCopyLink(campaign)}
              onViewLeads={() => onViewLeads(campaign.tag)}
              onToggleStatus={() =>
                updateMutation.mutate({
                  id: campaign.id,
                  data: { status: campaign.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE' },
                })
              }
              onEdit={() => setEditCampaign(campaign)}
              onDelete={() => handleDelete(campaign)}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      {showCreate && (
        <CreateCampaignDialog
          orgSlug={orgSlug}
          onClose={() => setShowCreate(false)}
        />
      )}

      {editCampaign && (
        <EditCampaignDialog
          campaign={editCampaign}
          onClose={() => setEditCampaign(null)}
        />
      )}
    </div>
  )
}

// ============================================
// Default Registration Card
// ============================================

function DefaultRegistrationCard({ orgSlug }: { orgSlug: string | null }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    return () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current) }
  }, [])

  const baseUrl = orgSlug ? `${PORTAL_BASE_URL}/register/${orgSlug}` : ''

  const handleCopy = useCallback(async () => {
    if (!baseUrl) return
    try {
      await navigator.clipboard.writeText(baseUrl)
      setCopied(true)
      toast.success(t('leads.copiedLink'))
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('settings.copyFailed'))
    }
  }, [baseUrl, t])

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LinkIcon className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{t('leads.defaultRegistration')}</h3>
        </div>
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          {t('leads.campaignActive')}
        </span>
      </div>

      {!orgSlug ? (
        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{t('leads.noSlugWarning')}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <code className="flex-1 px-2.5 py-1.5 bg-muted rounded-lg text-xs text-muted-foreground truncate">
            {baseUrl}
          </code>
          <button
            onClick={handleCopy}
            className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors shrink-0"
            title={t('leads.copyLink')}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-primary" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{t('leads.defaultRegistrationDesc')}</p>
    </div>
  )
}

// ============================================
// Campaign Card
// ============================================

interface CampaignCardProps {
  campaign: Campaign
  orgSlug: string | null
  copiedId: string | null
  onCopyLink: () => void
  onViewLeads: () => void
  onToggleStatus: () => void
  onEdit: () => void
  onDelete: () => void
}

function CampaignCard({
  campaign, orgSlug, copiedId,
  onCopyLink, onViewLeads, onToggleStatus, onEdit, onDelete,
}: CampaignCardProps) {
  const { t } = useTranslation()
  const isArchived = campaign.status === 'ARCHIVED'
  const registrationUrl = orgSlug
    ? `${PORTAL_BASE_URL}/register/${orgSlug}/${campaign.slug}`
    : null

  return (
    <div className={cn(
      'rounded-xl border bg-card p-4 space-y-3',
      isArchived ? 'border-border opacity-70' : 'border-border'
    )}>
      {/* Name + Status */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground truncate">{campaign.name}</h3>
        <span className={cn(
          'px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ml-2',
          isArchived
            ? 'bg-muted text-muted-foreground'
            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
        )}>
          {isArchived ? t('leads.campaignArchive') : t('leads.campaignActive')}
        </span>
      </div>

      {/* Registration Link */}
      {registrationUrl && (
        <div className="flex items-center gap-2">
          <code className="flex-1 px-2.5 py-1.5 bg-muted rounded-lg text-xs text-muted-foreground truncate">
            {registrationUrl}
          </code>
          <button
            onClick={onCopyLink}
            className="p-1.5 rounded-lg border border-border hover:bg-muted transition-colors shrink-0"
            title={t('leads.copyLink')}
          >
            {copiedId === campaign.id ? (
              <Check className="w-3.5 h-3.5 text-primary" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </button>
        </div>
      )}

      {/* Tag */}
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-muted-foreground">{t('leads.campaignTag')}:</span>
        <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium font-mono">
          {campaign.tag}
        </span>
      </div>

      {/* Description */}
      {campaign.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{campaign.description}</p>
      )}

      {/* Meta row */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <button
          onClick={onViewLeads}
          className="flex items-center gap-1 hover:text-primary transition-colors"
        >
          <Users className="w-3.5 h-3.5" />
          {t('leads.campaignLeadCount', { count: campaign._count.leads })}
        </button>
        <span>
          {t('leads.campaignCreatedBy', { name: campaign.createdBy.name })} · {new Date(campaign.createdAt).toLocaleDateString()}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 pt-1 border-t border-border">
        <button
          onClick={onToggleStatus}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted transition-colors text-muted-foreground"
        >
          {isArchived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
          {isArchived ? t('leads.campaignActivate') : t('leads.campaignArchive')}
        </button>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted transition-colors text-muted-foreground"
        >
          <Pencil className="w-3.5 h-3.5" />
          {t('leads.campaignEdit')}
        </button>
        {campaign._count.leads === 0 && (
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors text-red-500"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t('leads.campaignDelete')}
          </button>
        )}
      </div>
    </div>
  )
}
