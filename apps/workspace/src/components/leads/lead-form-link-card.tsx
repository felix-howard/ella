/**
 * Lead Form Link Card - Card showing registration form URL with copy + campaign slug
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { Copy, Check, Link as LinkIcon, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api-client'
import { PORTAL_BASE_URL } from '../../lib/constants'
import { toast } from '../../stores/toast-store'

export function LeadFormLinkCard() {
  const { t } = useTranslation()
  const [eventSlug, setEventSlug] = useState('')
  const [copied, setCopied] = useState<'base' | 'campaign' | null>(null)
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
  const campaignUrl = orgSlug && eventSlug
    ? `${PORTAL_BASE_URL}/register/${orgSlug}/${eventSlug}`
    : ''

  const handleCopy = useCallback(async (url: string, type: 'base' | 'campaign') => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(type)
      toast.success(t('leads.copiedLink'))
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopied(null), 2000)
    } catch {
      toast.error(t('settings.copyFailed'))
    }
  }, [t])

  const handleSlugChange = (value: string) => {
    setEventSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
  }

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
                onClick={() => handleCopy(baseUrl, 'base')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors shrink-0"
              >
                {copied === 'base' ? (
                  <Check className="w-4 h-4 text-primary" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copied === 'base' ? t('leads.copiedLink') : t('leads.copyLink')}
              </button>
            </div>

            {/* Campaign tag input */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                {t('leads.campaignTag')}
              </label>
              <input
                type="text"
                value={eventSlug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder={t('leads.campaignTagPlaceholder')}
                maxLength={50}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            {/* Campaign URL (shown when slug entered) */}
            {campaignUrl && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  {t('leads.campaignUrl')}
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-muted rounded-lg text-sm text-foreground truncate">
                    {campaignUrl}
                  </code>
                  <button
                    onClick={() => handleCopy(campaignUrl, 'campaign')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors shrink-0"
                  >
                    {copied === 'campaign' ? (
                      <Check className="w-4 h-4 text-primary" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    {copied === 'campaign' ? t('leads.copiedLink') : t('leads.copyLink')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
