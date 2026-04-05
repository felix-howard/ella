/**
 * Create Campaign Dialog - Modal for creating a new campaign with auto-slug
 */
import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { api } from '../../lib/api-client'
import { PORTAL_BASE_URL } from '../../lib/constants'
import { toast } from '../../stores/toast-store'

interface CreateCampaignDialogProps {
  orgSlug: string | null
  onClose: () => void
}

export function CreateCampaignDialog({ orgSlug, onClose }: CreateCampaignDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [tag, setTag] = useState('')
  const [description, setDescription] = useState('')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [tagManuallyEdited, setTagManuallyEdited] = useState(false)

  const createMutation = useMutation({
    mutationFn: (data: { name: string; slug: string; tag: string; description?: string }) =>
      api.campaigns.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success(t('leads.campaignCreated'))
      onClose()
    },
    onError: (err: unknown) => {
      // Check for 409 slug conflict
      const status = err && typeof err === 'object' && 'status' in err ? (err as { status: number }).status : 0
      if (status === 409) {
        toast.error(t('leads.campaignSlugExists'))
      } else {
        toast.error(t('leads.updateError'))
      }
    },
  })

  const generateSlug = useCallback((value: string) => {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+$/, '')
      .replace(/^-+/, '')
  }, [])

  const handleNameChange = (value: string) => {
    setName(value)
    if (!slugManuallyEdited) {
      setSlug(generateSlug(value))
    }
    if (!tagManuallyEdited) {
      setTag(generateSlug(value))
    }
  }

  const handleSlugChange = (value: string) => {
    setSlugManuallyEdited(true)
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
  }

  const handleTagChange = (value: string) => {
    setTagManuallyEdited(true)
    setTag(value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !slug.trim() || !tag.trim()) return
    createMutation.mutate({
      name: name.trim(),
      slug: slug.trim(),
      tag: tag.trim(),
      description: description.trim() || undefined,
    })
  }

  const previewUrl = orgSlug && slug
    ? `${PORTAL_BASE_URL}/register/${orgSlug}/${slug}`
    : null

  const isValid = name.trim().length > 0 && /^[a-z0-9-]+$/.test(slug) && slug.length > 0 && tag.trim().length > 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl border border-border w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">{t('leads.createCampaign')}</h2>
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
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={t('leads.campaignNamePlaceholder')}
              maxLength={100}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              autoFocus
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t('leads.campaignSlug')}
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder={t('leads.campaignSlugPlaceholder')}
              maxLength={50}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            {slug && !/^[a-z0-9-]+$/.test(slug) && (
              <p className="text-xs text-red-500 mt-1">Only lowercase letters, numbers, and hyphens</p>
            )}
          </div>

          {/* URL Preview */}
          {previewUrl && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                {t('leads.slugPreview')}
              </label>
              <code className="block px-3 py-2 bg-muted rounded-lg text-xs text-muted-foreground break-all">
                {previewUrl}
              </code>
            </div>
          )}

          {/* Tag */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t('leads.campaignTag')}
            </label>
            <input
              type="text"
              value={tag}
              onChange={(e) => handleTagChange(e.target.value)}
              placeholder={t('leads.campaignTagPlaceholder')}
              maxLength={50}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('leads.campaignTagHint')}
            </p>
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
              disabled={!isValid || createMutation.isPending}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? t('common.loading') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
