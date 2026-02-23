/**
 * Draft Return Summary - Active draft display with link and actions
 * Features: copy link, revoke, extend, version history
 */
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Copy,
  Link2Off,
  Clock,
  Eye,
  Upload,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
} from 'lucide-react'
import { cn, Button } from '@ella/ui'
import { toast } from '../../stores/toast-store'
import { api } from '../../lib/api-client'
import { formatRelativeTime, formatBytes } from '../../lib/formatters'
import type { DraftReturnData, DraftMagicLinkData, DraftVersionData } from '../../lib/api-client'

interface DraftReturnSummaryProps {
  draftReturn: DraftReturnData
  magicLink: DraftMagicLinkData | null
  versions: DraftVersionData[]
  caseId: string
  onActionComplete: () => void
}

export function DraftReturnSummary({
  draftReturn,
  magicLink,
  versions,
  caseId,
  onActionComplete,
}: DraftReturnSummaryProps) {
  const { t, i18n } = useTranslation()
  const [showVersions, setShowVersions] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)
  const [isExtending, setIsExtending] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [copied, setCopied] = useState(false)

  // Copy link to clipboard
  const handleCopy = useCallback(async () => {
    if (!magicLink?.url) return
    await navigator.clipboard.writeText(magicLink.url)
    setCopied(true)
    toast.success(t('draftReturn.linkCopied'))
    setTimeout(() => setCopied(false), 2000)
  }, [magicLink?.url, t])

  // Revoke link
  const handleRevoke = useCallback(async () => {
    if (!confirm(t('draftReturn.revokeConfirm'))) return
    setIsRevoking(true)
    try {
      await api.draftReturns.revoke(draftReturn.id)
      toast.success(t('draftReturn.revokeSuccess'))
      onActionComplete()
    } catch {
      toast.error(t('draftReturn.revokeError'))
    } finally {
      setIsRevoking(false)
    }
  }, [draftReturn.id, t, onActionComplete])

  // Extend expiry
  const handleExtend = useCallback(async () => {
    setIsExtending(true)
    try {
      await api.draftReturns.extend(draftReturn.id)
      toast.success(t('draftReturn.extendSuccess'))
      onActionComplete()
    } catch {
      toast.error(t('draftReturn.extendError'))
    } finally {
      setIsExtending(false)
    }
  }, [draftReturn.id, t, onActionComplete])

  // Upload new version
  const handleUploadNew = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (file.type !== 'application/pdf') {
      toast.error(t('draftReturn.errorPdfOnly'))
      return
    }

    setIsUploading(true)
    try {
      const result = await api.draftReturns.upload(caseId, file)
      toast.success(t('draftReturn.uploadSuccess'))
      await navigator.clipboard.writeText(result.portalUrl)
      toast.success(t('draftReturn.linkCopied'))
      onActionComplete()
    } catch {
      toast.error(t('draftReturn.uploadError'))
    } finally {
      setIsUploading(false)
    }
  }, [caseId, t, onActionComplete])

  // Calculate expiry info
  const expiresAt = magicLink?.expiresAt ? new Date(magicLink.expiresAt) : null
  const isExpired = expiresAt ? expiresAt < new Date() : false
  const daysUntilExpiry = expiresAt
    ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="space-y-4">
      {/* Main card */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: PDF info */}
          <div className="flex-1">
            <div className="flex items-start gap-4">
              {/* PDF icon */}
              <div className="w-16 h-20 bg-muted rounded flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-muted-foreground">PDF</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground truncate">{draftReturn.filename}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('draftReturn.version')} {draftReturn.version} &middot; {formatBytes(draftReturn.fileSize)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('draftReturn.uploadedBy')} {draftReturn.uploadedBy.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatRelativeTime(draftReturn.uploadedAt, i18n.language)}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Link & actions */}
          <div className="lg:w-80 flex-shrink-0">
            {magicLink && !isExpired ? (
              <>
                {/* Link display */}
                <div className="bg-muted rounded-lg p-3 mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t('draftReturn.shareableLink')}
                    </span>
                    {magicLink.isActive && (
                      <span className="px-1.5 py-0.5 text-xs bg-success/10 text-success rounded">
                        {t('draftReturn.active')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-background rounded px-2 py-1.5 truncate">
                      {magicLink.url}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      className="gap-1.5 flex-shrink-0"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-success" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Stats & expiry */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                  <span className="flex items-center gap-1.5">
                    <Eye className="w-4 h-4" />
                    {draftReturn.viewCount} {t('draftReturn.views')}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {daysUntilExpiry && daysUntilExpiry > 0
                      ? t('draftReturn.expiresIn', { days: daysUntilExpiry })
                      : t('draftReturn.expiringToday')}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExtend}
                    disabled={isExtending}
                    className="gap-1.5"
                  >
                    {isExtending && <Loader2 className="w-4 h-4 animate-spin" />}
                    <Clock className="w-4 h-4" />
                    {t('draftReturn.extend')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRevoke}
                    disabled={isRevoking}
                    className="gap-1.5 text-destructive hover:text-destructive"
                  >
                    {isRevoking && <Loader2 className="w-4 h-4 animate-spin" />}
                    <Link2Off className="w-4 h-4" />
                    {t('draftReturn.revoke')}
                  </Button>
                </div>
              </>
            ) : (
              <div className="bg-destructive/10 rounded-lg p-3 text-center">
                <p className="text-sm text-destructive font-medium">
                  {isExpired ? t('draftReturn.linkExpired') : t('draftReturn.noActiveLink')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('draftReturn.uploadNewToShare')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Upload new version button */}
        <div className="mt-4 pt-4 border-t border-border">
          <label className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer',
            isUploading && 'opacity-50 pointer-events-none'
          )}>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleUploadNew}
              className="sr-only"
              disabled={isUploading}
            />
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {t('draftReturn.uploadNewVersion')}
          </label>
        </div>
      </div>

      {/* Version history */}
      {versions.length > 1 && (
        <div className="bg-card rounded-xl border border-border">
          <button
            onClick={() => setShowVersions(!showVersions)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
          >
            <span>{t('draftReturn.versionHistory')} ({versions.length})</span>
            {showVersions ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          {showVersions && (
            <div className="px-4 pb-3 space-y-2">
              {versions.map((v) => (
                <div
                  key={v.version}
                  className={cn(
                    'flex items-center justify-between py-2 px-3 rounded text-sm',
                    v.status === 'ACTIVE' ? 'bg-primary/5' : 'bg-muted/30'
                  )}
                >
                  <span>
                    v{v.version}
                    {v.status === 'ACTIVE' && (
                      <span className="ml-2 text-xs text-primary">({t('draftReturn.current')})</span>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {formatRelativeTime(v.uploadedAt, i18n.language)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
