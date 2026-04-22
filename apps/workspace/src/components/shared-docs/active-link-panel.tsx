/**
 * ActiveLinkPanel - Renders the active link row: URL + copy + open + stats + extend + pause.
 * Factored out of shared-doc-link-bar to keep files under the 200-line guideline.
 */
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Check, ExternalLink, Eye } from 'lucide-react'
import { Button } from '@ella/ui'
import { copyToClipboard } from '../../lib/clipboard'
import { ExpiryBadge } from './expiry-badge'
import { ExtendLinkMenu } from './extend-link-menu'
import type { ExtendDuration } from '../../hooks/use-shared-docs'
import type { LinkStateResult } from './compute-link-state'

interface ActiveLinkPanelProps {
  url: string
  viewCount: number
  linkState: LinkStateResult
  language: string
  isExtending: boolean
  isPausing: boolean
  onExtend: (duration: ExtendDuration) => void
  onPauseClick: () => void
}

export function ActiveLinkPanel({
  url,
  viewCount,
  linkState,
  language,
  isExtending,
  isPausing,
  onExtend,
  onPauseClick,
}: ActiveLinkPanelProps) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(url, {
      successMsg: t('sharedDocs.linkCopied'),
      errorMsg: t('sharedDocs.copyFailed'),
    })
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [url, t])

  const handleOpen = useCallback(() => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [url])

  return (
    <div className="space-y-2 flex-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2 bg-muted/50 dark:bg-muted/30 rounded-md px-2.5 py-1.5 border border-border/30">
          <code className="flex-1 text-xs truncate text-foreground/80">{url}</code>
          <button
            onClick={handleCopy}
            className="flex-shrink-0 w-6 h-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={t('sharedDocs.copyLink')}
            aria-label={t('sharedDocs.copyLink')}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={handleOpen}
          className="gap-1.5 flex-shrink-0 h-8"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          {t('sharedDocs.openLink')}
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded text-[10px] font-medium">
            {t('sharedDocs.active')}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {viewCount}
          </span>
          <span className="text-muted-foreground/50">·</span>
          <ExpiryBadge result={linkState} language={language} />
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <ExtendLinkMenu onSelect={onExtend} isLoading={isExtending} />
          <button
            onClick={onPauseClick}
            disabled={isPausing}
            aria-label={t('sharedDocs.actions.pause')}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors disabled:opacity-50"
          >
            {t('sharedDocs.actions.pause')}
          </button>
        </div>
      </div>
    </div>
  )
}
