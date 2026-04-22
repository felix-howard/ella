/**
 * SharedDocLinkBar - Magic link row (URL + copy/open/extend/revoke)
 * Uses copyToClipboard utility (phase 03) to avoid "Document not focused" errors.
 */
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Check, ExternalLink, Clock, Eye } from 'lucide-react'
import { Button } from '@ella/ui'
import { toast } from '../../stores/toast-store'
import { copyToClipboard } from '../../lib/clipboard'
import { useSharedDocs } from '../../hooks/use-shared-docs'
import { ExtendLinkModal } from './extend-link-modal'
import { RevokeLinkModal } from './revoke-link-modal'
import type { SharedDocMagicLinkData } from '../../lib/api-client'

interface SharedDocLinkBarProps {
  sectionId: string
  caseId: string
  magicLink: SharedDocMagicLinkData | null
  viewCount: number
}

export function SharedDocLinkBar({
  sectionId,
  caseId,
  magicLink,
  viewCount,
}: SharedDocLinkBarProps) {
  const { t } = useTranslation()
  const { extendLink, isExtending, revokeLink, isRevoking } = useSharedDocs({ caseId })
  const [copied, setCopied] = useState(false)
  const [showExtendModal, setShowExtendModal] = useState(false)
  const [showRevokeModal, setShowRevokeModal] = useState(false)

  const expiresAt = magicLink?.expiresAt ? new Date(magicLink.expiresAt) : null
  const isExpired = expiresAt ? expiresAt < new Date() : false
  const isInactive = !magicLink?.isActive
  const daysUntilExpiry = expiresAt
    // eslint-disable-next-line react-hooks/purity
    ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  const handleCopy = useCallback(async () => {
    if (!magicLink?.url) return
    const ok = await copyToClipboard(magicLink.url, {
      successMsg: t('sharedDocs.linkCopied'),
      errorMsg: t('sharedDocs.copyFailed'),
    })
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [magicLink?.url, t])

  const handleOpenLink = useCallback(() => {
    if (!magicLink?.url) return
    window.open(magicLink.url, '_blank', 'noopener,noreferrer')
  }, [magicLink?.url])

  const handleExtendConfirm = useCallback(async () => {
    try {
      await extendLink(sectionId)
      toast.success(t('sharedDocs.extendSuccess'))
      setShowExtendModal(false)
    } catch {
      toast.error(t('sharedDocs.extendError'))
    }
  }, [sectionId, t, extendLink])

  const handleRevokeConfirm = useCallback(async () => {
    try {
      await revokeLink(sectionId)
      toast.success(t('sharedDocs.revokeSuccess'))
      setShowRevokeModal(false)
    } catch {
      toast.error(t('sharedDocs.revokeError'))
    }
  }, [sectionId, t, revokeLink])

  if (!magicLink || isExpired || isInactive) {
    return (
      <div className="bg-destructive/5 rounded-md px-3 py-2 text-xs">
        <span className="text-destructive font-medium">
          {isExpired ? t('sharedDocs.linkExpired') : t('sharedDocs.noActiveLink')}
        </span>
        <span className="text-muted-foreground ml-1.5">{t('sharedDocs.uploadNewToShare')}</span>
      </div>
    )
  }

  return (
    <div className="space-y-2 flex-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2 bg-muted/50 dark:bg-muted/30 rounded-md px-2.5 py-1.5 border border-border/30">
          <code className="flex-1 text-xs truncate text-foreground/80">{magicLink.url}</code>
          <button
            onClick={handleCopy}
            className="flex-shrink-0 w-6 h-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={t('sharedDocs.copyLink')}
            aria-label={t('sharedDocs.copyLink')}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
        <Button variant="default" size="sm" onClick={handleOpenLink} className="gap-1.5 flex-shrink-0 h-8">
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
          <span className="flex items-center gap-1 truncate">
            <Clock className="w-3 h-3" />
            {daysUntilExpiry && daysUntilExpiry > 0
              ? t('sharedDocs.expiresIn', { days: daysUntilExpiry })
              : t('sharedDocs.expiringToday')}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setShowExtendModal(true)}
            className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
          >
            {t('sharedDocs.extend')}
          </button>
          <button
            onClick={() => setShowRevokeModal(true)}
            className="text-xs text-destructive hover:underline transition-colors"
          >
            {t('sharedDocs.revoke')}
          </button>
        </div>
      </div>

      <ExtendLinkModal
        isOpen={showExtendModal}
        onClose={() => setShowExtendModal(false)}
        onConfirm={handleExtendConfirm}
        currentExpiryDate={expiresAt}
        isLoading={isExtending}
      />

      <RevokeLinkModal
        isOpen={showRevokeModal}
        onClose={() => setShowRevokeModal(false)}
        onConfirm={handleRevokeConfirm}
        currentExpiryDate={expiresAt}
        viewCount={viewCount}
        isLoading={isRevoking}
      />
    </div>
  )
}
