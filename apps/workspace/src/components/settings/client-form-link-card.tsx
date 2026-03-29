/**
 * Client Form Link Card - Shows generic intake form link + org slug editor + auto-send toggle
 * Used in Settings Form Links tab
 */
import { useState } from 'react'
import { Copy, Check, Link as LinkIcon, Send, AlertTriangle, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, cn, Button, Input } from '@ella/ui'
import { api } from '../../lib/api-client'
import { PORTAL_BASE_URL } from '../../lib/constants'
import { toast } from '../../stores/toast-store'
import { useOrgRole } from '../../hooks/use-org-role'

export function ClientFormLinkCard() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { isAdmin } = useOrgRole()
  const [copied, setCopied] = useState(false)
  const [isEditingSlug, setIsEditingSlug] = useState(false)
  const [slugValue, setSlugValue] = useState('')
  const [slugError, setSlugError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['org-settings'],
    queryFn: () => api.orgSettings.get(),
  })

  // Sync slug value when data changes (adjust state during render pattern)
  const [prevSlug, setPrevSlug] = useState(data?.slug)
  if (data?.slug !== prevSlug) {
    setPrevSlug(data?.slug)
    if (!isEditingSlug && data?.slug) {
      setSlugValue(data.slug)
    }
  }

  const slugMutation = useMutation({
    mutationFn: (newSlug: string) =>
      api.orgSettings.update({ slug: newSlug }),
    onSuccess: (result) => {
      queryClient.setQueryData(['org-settings'], result)
      toast.success(t('settings.saved'))
      setIsEditingSlug(false)
    },
    onError: (err: Error) => {
      if (err.message.includes('SLUG_TAKEN')) {
        setSlugError(t('settings.slugTaken'))
      } else {
        toast.error(err.message || t('settings.saveFailed'))
      }
    },
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

  const validateSlug = (value: string): boolean => {
    if (!value) {
      setSlugError(t('settings.slugRequired'))
      return false
    }
    if (!/^[a-z0-9-]+$/.test(value)) {
      setSlugError(t('settings.slugInvalidFormat'))
      return false
    }
    if (value.length < 2 || value.length > 50) {
      setSlugError(t('settings.slugInvalidLength'))
      return false
    }
    setSlugError(null)
    return true
  }

  const handleSaveSlug = () => {
    const trimmed = slugValue.trim().toLowerCase()
    if (!validateSlug(trimmed)) return
    slugMutation.mutate(trimmed)
  }

  const handleCancelSlug = () => {
    setSlugValue(data?.slug || '')
    setSlugError(null)
    setIsEditingSlug(false)
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

      {/* Org Slug Editor (admin only) */}
      {isAdmin && (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            {t('settings.orgSlug')}
          </label>
          {isEditingSlug ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={slugValue}
                  onChange={(e) => {
                    setSlugValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                    setSlugError(null)
                  }}
                  placeholder="my-company"
                  className="flex-1"
                  disabled={slugMutation.isPending}
                />
                <Button
                  size="sm"
                  onClick={handleSaveSlug}
                  disabled={slugMutation.isPending}
                >
                  {slugMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    t('common.save')
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelSlug}
                  disabled={slugMutation.isPending}
                >
                  {t('common.cancel')}
                </Button>
              </div>
              {slugError && (
                <p className="text-xs text-destructive">{slugError}</p>
              )}
              {data?.slug && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-3 h-3" />
                  {t('settings.slugChangeWarning')}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <code className="px-2 py-1 bg-muted rounded text-sm">
                {data?.slug || t('settings.noSlugSet')}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSlugValue(data?.slug || '')
                  setIsEditingSlug(true)
                }}
              >
                {data?.slug ? t('common.edit') : t('settings.setSlug')}
              </Button>
            </div>
          )}
        </div>
      )}

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
