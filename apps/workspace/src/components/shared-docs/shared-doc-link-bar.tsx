/**
 * SharedDocLinkBar - Magic link row (URL + copy/open/extend/revoke)
 * Uses copyToClipboard utility (phase 03) to avoid "Document not focused" errors.
 */
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Check, ExternalLink, Clock, Link2Off, Eye } from 'lucide-react'
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
      <div className="bg-destructive/10 rounded-lg p-4 flex-1 flex flex-col items-center justify-center">
        <p className="text-sm text-destructive font-medium">
          {isExpired ? t('sharedDocs.linkExpired') : t('sharedDocs.noActiveLink')}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {t('sharedDocs.uploadNewToShare')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 flex-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {t('sharedDocs.shareableLink')}
          </span>
          <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full">
            {t('sharedDocs.active')}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Eye className="w-4 h-4" />
            {viewCount} {t('sharedDocs.views')}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            {daysUntilExpiry && daysUntilExpiry > 0
              ? t('sharedDocs.expiresIn', { days: daysUntilExpiry })
              : t('sharedDocs.expiringToday')}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-muted/50 dark:bg-muted/30 rounded-xl px-3 py-2 border border-border/30">
          <code className="flex-1 text-sm truncate text-foreground/80">{magicLink.url}</code>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="gap-1.5 flex-shrink-0"
          title={t('sharedDocs.copyLink')}
        >
          {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
        </Button>
        <Button variant="default" size="sm" onClick={handleOpenLink} className="gap-1.5 flex-shrink-0">
          <ExternalLink className="w-4 h-4" />
          {t('sharedDocs.openLink')}
        </Button>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={() => setShowExtendModal(true)} className="gap-1.5">
          <Clock className="w-4 h-4" />
          {t('sharedDocs.extend')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowRevokeModal(true)}
          className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Link2Off className="w-4 h-4" />
          {t('sharedDocs.revoke')}
        </Button>
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
