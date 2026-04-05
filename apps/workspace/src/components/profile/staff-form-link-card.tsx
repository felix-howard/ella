/**
 * Staff Form Link Card - Shows personal intake form link with editable slug
 * Used in Staff Profile page
 */
import { useState } from 'react'
import { Copy, Check, Link as LinkIcon, AlertTriangle, Loader2, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Button, Input } from '@ella/ui'
import { api } from '../../lib/api-client'
import { PORTAL_BASE_URL } from '../../lib/constants'
import { toast } from '../../stores/toast-store'

interface StaffFormLinkCardProps {
  staffId: string
  formSlug: string | null
  orgSlug: string | null
  canEdit: boolean
  autoSendUploadLink: boolean
}

export function StaffFormLinkCard({
  staffId,
  formSlug,
  orgSlug,
  canEdit,
  autoSendUploadLink,
}: StaffFormLinkCardProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [slugValue, setSlugValue] = useState(formSlug || '')
  const [slugError, setSlugError] = useState<string | null>(null)

  // Sync slug value when prop changes (adjust state during render pattern)
  const [prevFormSlug, setPrevFormSlug] = useState(formSlug)
  if (formSlug !== prevFormSlug) {
    setPrevFormSlug(formSlug)
    if (!isEditing) {
      setSlugValue(formSlug || '')
    }
  }

  const mutation = useMutation({
    mutationFn: (newSlug: string | null) =>
      api.staff.updateFormSlug(staffId, newSlug),
    onSuccess: () => {
      toast.success(t('profile.slugSaved'))
      queryClient.invalidateQueries({ queryKey: ['team-member-profile', staffId] })
      queryClient.invalidateQueries({ queryKey: ['staff-me'] })
      setIsEditing(false)
    },
    onError: (err: Error) => {
      if (err.message.includes('already') || err.message.includes('SLUG_TAKEN')) {
        setSlugError(t('profile.slugTaken'))
      } else {
        toast.error(err.message || t('profile.slugSaveFailed'))
      }
    },
  })

  const [optimisticAutoSend, setOptimisticAutoSend] = useState(autoSendUploadLink)

  // Sync optimistic state when prop changes from server
  const [prevAutoSend, setPrevAutoSend] = useState(autoSendUploadLink)
  if (autoSendUploadLink !== prevAutoSend) {
    setPrevAutoSend(autoSendUploadLink)
    setOptimisticAutoSend(autoSendUploadLink)
  }

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      api.staff.updateAutoSendUploadLink(enabled),
    onMutate: (enabled: boolean) => {
      setOptimisticAutoSend(enabled)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-member-profile', staffId] })
      toast.success(t('settings.saved'))
    },
    onError: () => {
      setOptimisticAutoSend(autoSendUploadLink)
      toast.error(t('settings.saveFailed'))
    },
  })

  const formLink = orgSlug && formSlug
    ? `${PORTAL_BASE_URL}/form/${orgSlug}/${formSlug}`
    : null

  const handleCopy = async () => {
    if (!formLink) return
    try {
      await navigator.clipboard.writeText(formLink)
      setCopied(true)
      toast.success(t('profile.linkCopied'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('profile.copyFailed'))
    }
  }

  const validateSlug = (value: string): boolean => {
    if (!value) return true
    if (!/^[a-z0-9-]+$/.test(value)) {
      setSlugError(t('profile.slugInvalidFormat'))
      return false
    }
    if (value.length < 2 || value.length > 50) {
      setSlugError(t('profile.slugInvalidLength'))
      return false
    }
    setSlugError(null)
    return true
  }

  const handleSave = () => {
    const trimmed = slugValue.trim().toLowerCase()
    if (!validateSlug(trimmed)) return
    mutation.mutate(trimmed || null)
  }

  const handleCancel = () => {
    setSlugValue(formSlug || '')
    setSlugError(null)
    setIsEditing(false)
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
            <LinkIcon className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">
              {t('profile.formLink')}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t('profile.formLinkDescription')}
            </p>
          </div>
        </div>
      </div>

      {/* Slug Edit */}
      {canEdit && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            {t('profile.formSlug')}
          </label>
          {isEditing ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={slugValue}
                  onChange={(e) => {
                    setSlugValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                    setSlugError(null)
                  }}
                  placeholder="john-doe"
                  className="flex-1"
                  disabled={mutation.isPending}
                />
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    t('common.save')
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={mutation.isPending}
                >
                  {t('common.cancel')}
                </Button>
              </div>
              {slugError && (
                <p className="text-xs text-destructive">{slugError}</p>
              )}
              <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3 h-3" />
                {t('profile.slugChangeWarning')}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <code className="px-2 py-1 bg-muted rounded text-sm">
                {formSlug || t('profile.noSlug')}
              </code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditing(true)}
              >
                {t('common.edit')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Form Link */}
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
            {copied ? t('profile.copied') : t('profile.copy')}
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          {!orgSlug
            ? t('profile.noOrgSlug')
            : t('profile.noFormSlug')}
        </p>
      )}
      {/* Auto-send Upload Link Toggle - only for own profile (API is /staff/me/) */}
      {canEdit && formLink && staffId === 'me' && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <Send className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {t('settings.autoSendUploadLink')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('settings.autoSendUploadLinkDescription')}
              </p>
            </div>
          </div>
          <button
            onClick={() => toggleMutation.mutate(!optimisticAutoSend)}
            disabled={toggleMutation.isPending}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              optimisticAutoSend ? 'bg-primary' : 'bg-muted-foreground/40'
            }`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              optimisticAutoSend ? 'translate-x-5' : 'translate-x-0.5'
            }`} />
          </button>
        </div>
      )}
    </Card>
  )
}
