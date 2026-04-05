/**
 * Edit Campaign Dialog - Modal for editing campaign name and description
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { api } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import type { Campaign } from '../../lib/api-client'

interface EditCampaignDialogProps {
  campaign: Campaign
  onClose: () => void
}

export function EditCampaignDialog({ campaign, onClose }: EditCampaignDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [name, setName] = useState(campaign.name)
  const [description, setDescription] = useState(campaign.description || '')

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; description?: string | null }) =>
      api.campaigns.update(campaign.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success(t('leads.campaignUpdated'))
      onClose()
    },
    onError: () => toast.error(t('leads.updateError')),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    updateMutation.mutate({
      name: name.trim(),
      description: description.trim() || null,
    })
  }

  const isValid = name.trim().length > 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">{t('leads.editCampaign')}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t('leads.campaignName')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('leads.campaignNamePlaceholder')}
              maxLength={100}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              autoFocus
            />
          </div>

          {/* Slug (read-only) */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t('leads.campaignSlug')}
            </label>
            <input
              type="text"
              value={campaign.slug}
              disabled
              className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-sm font-mono text-muted-foreground cursor-not-allowed"
            />
          </div>

          {/* Tag (read-only) */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t('leads.campaignTag')}
            </label>
            <input
              type="text"
              value={campaign.tag}
              disabled
              className="w-full px-3 py-2 rounded-lg border border-border bg-muted text-sm font-mono text-muted-foreground cursor-not-allowed"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t('leads.campaignDescription')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('leads.campaignDescriptionPlaceholder')}
              maxLength={500}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={!isValid || updateMutation.isPending}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {updateMutation.isPending ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
