import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { api } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import type { Campaign, RegistrationHeaderMode } from '../../lib/api-client'
import { RegistrationHeaderFields } from './registration-header-fields'
import { RichTextEditor } from './rich-text-editor'

interface EditCampaignDialogProps {
  campaign: Campaign
  onClose: () => void
}

export function EditCampaignDialog({ campaign, onClose }: EditCampaignDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [name, setName] = useState(campaign.name)
  const [description, setDescription] = useState(campaign.description || '')
  const [formHeaderMode, setFormHeaderMode] = useState<RegistrationHeaderMode>(campaign.formHeaderMode)
  const [formTitle, setFormTitle] = useState(campaign.formTitle ?? '')
  const [formSubtitle, setFormSubtitle] = useState(campaign.formSubtitle ?? '')
  const [formIntroContent, setFormIntroContent] = useState(campaign.formIntroContent ?? '')

  const updateMutation = useMutation({
    mutationFn: (data: {
      name?: string
      description?: string | null
      formHeaderMode?: RegistrationHeaderMode
      formTitle?: string | null
      formSubtitle?: string | null
      formIntroContent?: string | null
    }) =>
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
      formHeaderMode,
      formTitle: formHeaderMode === 'CUSTOM' ? formTitle.trim() || null : null,
      formSubtitle: formHeaderMode === 'CUSTOM' ? formSubtitle.trim() || null : null,
      formIntroContent: formIntroContent.trim() ? formIntroContent : null,
    })
  }

  const handleIntroImageUpload = async (file: File) => {
    try {
      const result = await api.campaigns.uploadIntroImage(file)
      return { src: result.url, alt: file.name }
    } catch (err) {
      toast.error(t('leads.rte.imageUploadFailed'))
      throw err
    }
  }

  const isValid = name.trim().length > 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl border border-border w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">{t('leads.editCampaign')}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4 overflow-y-auto">
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

          <RegistrationHeaderFields
            mode={formHeaderMode}
            title={formTitle}
            subtitle={formSubtitle}
            onModeChange={setFormHeaderMode}
            onTitleChange={setFormTitle}
            onSubtitleChange={setFormSubtitle}
            legend={t('leads.campaignHeaderMode')}
            description={t('leads.campaignHeaderDescription')}
            defaultLabel={t('registrationHeader.default')}
            customLabel={t('registrationHeader.custom')}
            hiddenLabel={t('registrationHeader.hidden')}
            defaultHelper={t('leads.campaignHeaderDefaultHelper')}
            customHelper={t('registrationHeader.customHelper')}
            hiddenHelper={t('registrationHeader.hiddenHelper')}
            titleLabel={t('registrationHeader.titleLabel')}
            subtitleLabel={t('registrationHeader.subtitleLabel')}
            titlePlaceholder={t('registrationHeader.titlePlaceholder')}
            subtitlePlaceholder={t('registrationHeader.subtitlePlaceholder')}
            disabled={updateMutation.isPending}
          />

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t('leads.campaignFormIntroLabel')}
            </label>
            <p className="text-xs text-muted-foreground mb-1.5">
              {t('leads.campaignFormIntroHint')}
            </p>
            <RichTextEditor
              value={formIntroContent}
              onChange={setFormIntroContent}
              placeholder={t('leads.campaignFormIntroPlaceholder')}
              maxLength={10_000}
              enableImages
              onImageUpload={handleIntroImageUpload}
            />
          </div>

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
