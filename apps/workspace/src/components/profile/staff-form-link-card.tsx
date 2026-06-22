import { useState } from 'react'
import { Link as RouterLink } from '@tanstack/react-router'
import { Check, Copy, Link as LinkIcon, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card } from '@ella/ui'
import { PORTAL_BASE_URL } from '../../lib/constants'
import { toast } from '../../stores/toast-store'

interface StaffFormLinkCardProps {
  staffName: string
  formSlug: string | null
  orgSlug: string | null
  canManageIntakeLinks: boolean
  isOrgSettingsLoading?: boolean
}

export function StaffFormLinkCard({
  staffName,
  formSlug,
  orgSlug,
  canManageIntakeLinks,
  isOrgSettingsLoading = false,
}: StaffFormLinkCardProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
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

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <LinkIcon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">
              {t('profile.personalIntakeLink')}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t('profile.personalIntakeLinkDescription', { name: staffName })}
            </p>
          </div>
        </div>
        {canManageIntakeLinks && (
          <RouterLink
            to="/settings"
            search={{ tab: 'organization', focus: 'client-intake' }}
            className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Settings className="h-3.5 w-3.5" />
            {t('profile.manageInSettings')}
          </RouterLink>
        )}
      </div>

      {formLink ? (
        <div className="flex flex-col gap-2 xl:flex-row xl:items-start">
          <code className="min-w-0 flex-1 whitespace-normal break-all rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
            {formLink}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {copied ? (
              <Check className="h-4 w-4 text-primary" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? t('profile.copied') : t('profile.copy')}
          </button>
        </div>
      ) : isOrgSettingsLoading ? (
        <div
          aria-hidden="true"
          data-testid="staff-form-link-loading"
          className="h-10 rounded-lg bg-muted animate-pulse"
        />
      ) : (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {!orgSlug
            ? t('profile.noOrgSlug')
            : t('profile.noFormSlug')}
        </p>
      )}
    </Card>
  )
}
