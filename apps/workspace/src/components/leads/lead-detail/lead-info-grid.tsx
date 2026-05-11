/**
 * Lead sidebar cards — Tags management.
 * (Contact info and Source now live in the header card to match client detail.)
 */
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { api } from '../../../lib/api-client'
import { toast } from '../../../stores/toast-store'
import { CardSection } from '../../shared/card-section'
import type { Lead } from '../../../lib/api-client'

interface Props {
  lead: Lead
}

export function LeadInfoGrid({ lead }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isConverted = lead.status === 'CONVERTED'

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['lead', lead.id] })
    queryClient.invalidateQueries({ queryKey: ['leads'] })
    queryClient.invalidateQueries({ queryKey: ['lead-tags'] })
  }

  const tagMutation = useMutation({
    mutationFn: (tags: string[]) => api.leads.update(lead.id, { tags }),
    onSuccess: invalidate,
    onError: () => toast.error(t('leads.updateError')),
  })

  const handleRemoveTag = (tag: string) => {
    const tags = (lead.tags ?? []).filter((existing) => existing !== tag)
    tagMutation.mutate(tags)
  }

  const customTags = (lead.tags ?? []).filter((tag) => tag !== lead.campaignTag)

  return (
    <div className="space-y-6">
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
