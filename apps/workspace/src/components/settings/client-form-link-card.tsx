/**
 * Client Form Link Card - Shows generic intake form link + auto-send toggle
 * Used in Settings Form Links tab
 */
import { useState } from 'react'
import { Copy, Check, Link as LinkIcon, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, cn } from '@ella/ui'
import { api } from '../../lib/api-client'
import { PORTAL_BASE_URL } from '../../lib/constants'
import { toast } from '../../stores/toast-store'

export function ClientFormLinkCard() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['org-settings'],
    queryFn: () => api.orgSettings.get(),
  })

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      api.orgSettings.update({ autoSendFormClientUploadLink: enabled }),
    onSuccess: (result) => {
      queryClient.setQueryData(['org-settings'], result)
      toast.success(t('settings.saved'))
    },
    onError: () => {
      toast.error(t('settings.saveFailed'))
    },
  })

  const formLink = data?.slug ? `${PORTAL_BASE_URL}/form/${data.slug}` : null
  const isAutoSendEnabled = data?.autoSendFormClientUploadLink ?? false

  const handleCopy = async () => {
    if (!formLink) return
    try {
      await navigator.clipboard.writeText(formLink)
      setCopied(true)
      toast.success(t('settings.linkCopied'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('settings.copyFailed'))
    }
  }

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="h-24 bg-muted rounded animate-pulse" />
      </Card>
    )
  }

  return (
    <Card className="p-6 space-y-4">
      {/* Form Link Section */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
            <LinkIcon className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">
              {t('settings.clientFormLink')}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t('settings.clientFormLinkDescription')}
            </p>
          </div>
        </div>
      </div>

      {formLink ? (
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 bg-muted rounded-lg text-sm text-foreground truncate">
            {formLink}
          </code>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors shrink-0"
          >
            {copied ? (
              <Check className="w-4 h-4 text-primary" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {copied ? t('settings.copied') : t('settings.copy')}
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          {t('settings.noSlugConfigured')}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        {t('settings.genericFormNote')}
      </p>

      {/* Auto-send toggle */}
      <div className="pt-4 border-t border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <Send className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground">
                {t('settings.autoSendUploadLink')}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t('settings.autoSendUploadLinkDescription')}
              </p>
            </div>
          </div>

          <button
            onClick={() => toggleMutation.mutate(!isAutoSendEnabled)}
            disabled={toggleMutation.isPending}
            className={cn(
              'relative w-11 h-6 rounded-full transition-colors cursor-pointer',
              isAutoSendEnabled ? 'bg-primary' : 'bg-muted-foreground/30'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                isAutoSendEnabled && 'translate-x-5'
              )}
            />
          </button>
        </div>
      </div>
    </Card>
  )
}
