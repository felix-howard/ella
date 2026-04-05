/**
 * Lead Form Link Card - Card showing base registration URL + campaign management reference
 */
import { useRef, useCallback, useEffect, useState } from 'react'
import { Copy, Check, Link as LinkIcon, AlertTriangle, Megaphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { api } from '../../lib/api-client'
import { PORTAL_BASE_URL } from '../../lib/constants'
import { toast } from '../../stores/toast-store'

export function LeadFormLinkCard() {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    return () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current) }
  }, [])

  const { data: orgSettings } = useQuery({
    queryKey: ['org-settings'],
    queryFn: () => api.orgSettings.get(),
  })

  const orgSlug = orgSettings?.slug || ''
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
    <div className="mb-4 rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3">
        <LinkIcon className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-foreground">
          {t('leads.formLink')}
        </span>
      </div>

      {/* Content */}
      <div className="px-4 pb-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          {t('leads.formLinkDesc')}
        </p>

        {!orgSlug ? (
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{t('leads.noSlugWarning')}</span>
          </div>
        ) : (
          <>
            {/* Base registration URL */}
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-muted rounded-lg text-sm text-foreground truncate">
                {baseUrl}
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
                {copied ? t('leads.copiedLink') : t('leads.copyLink')}
              </button>
            </div>

            {/* Campaign reference */}
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
              <Megaphone className="w-4 h-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground flex-1">
                {t('leads.campaignManageHint')}
              </p>
              <Link to="/leads" className="text-xs text-primary hover:underline whitespace-nowrap">
                {t('leads.campaignManageLink')}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
