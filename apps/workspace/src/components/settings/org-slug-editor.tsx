/**
 * Org Slug Editor - Shared org slug setting displayed at top of Form Links tab
 * The org slug is used by both Registration Form and Client Intake Form links
 */
import { useState } from 'react'
import { AlertTriangle, Loader2, Globe, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Input } from '@ella/ui'
import { api } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { useOrgRole } from '../../hooks/use-org-role'

export function OrgSlugEditor() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { canManageOrganizationSettings } = useOrgRole()
  const [isEditing, setIsEditing] = useState(false)
  const [slugValue, setSlugValue] = useState('')
  const [slugError, setSlugError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['org-settings'],
    queryFn: () => api.orgSettings.get(),
  })
  const currentSlug = data?.slug ?? ''
  const isReadOnly = !canManageOrganizationSettings

  const slugMutation = useMutation({
    mutationFn: (newSlug: string) =>
      api.orgSettings.update({ slug: newSlug }),
    onSuccess: (result) => {
      queryClient.setQueryData(['org-settings'], result)
      queryClient.invalidateQueries({ queryKey: ['org-intake-links'] })
      toast.success(t('settings.saved'))
      setIsEditing(false)
    },
    onError: (err: Error) => {
      if (err.message.includes('SLUG_TAKEN')) {
        setSlugError(t('settings.slugTaken'))
      } else {
        toast.error(err.message || t('settings.saveFailed'))
      }
    },
  })

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

  const handleSave = () => {
    if (!canManageOrganizationSettings) return
    const trimmed = slugValue.trim().toLowerCase()
    if (!validateSlug(trimmed)) return
    slugMutation.mutate(trimmed)
  }

  const handleCancel = () => {
    setSlugValue(currentSlug)
    setSlugError(null)
    setIsEditing(false)
  }

  if (isLoading) return null
  const showEditor = !isReadOnly && isEditing

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Globe className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {t('settings.organizationUrlSlug')}
          </span>
        </div>
        {isReadOnly && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <Lock className="h-3 w-3" />
            {t('settings.adminOnly')}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {!isReadOnly
          ? t('settings.organizationUrlSlugDescription')
          : t('settings.organizationUrlSlugAdminOnly')}
      </p>

      {showEditor ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              id="organization-url-slug-input"
              aria-label={t('settings.organizationUrlSlug')}
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
              onClick={handleSave}
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
              onClick={handleCancel}
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
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <code className="px-2 py-1 bg-muted rounded text-sm">
              {currentSlug || t('settings.noSlugSet')}
            </code>
            {!isReadOnly && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSlugValue(currentSlug)
                  setIsEditing(true)
                }}
              >
                {currentSlug ? t('common.edit') : t('settings.setSlug')}
              </Button>
            )}
          </div>
          {isReadOnly && !currentSlug && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              {t('settings.organizationUrlSlugMissingAskAdmin')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
