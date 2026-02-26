/**
 * Draft Return Summary - Polished active draft display with link and actions
 * Features: PDF thumbnail, open link, copy link, revoke, extend, version history
 */
import { useState, useCallback, lazy, Suspense } from 'react'
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
  ExternalLink,
  FileText,
  Download,
} from 'lucide-react'
import { cn, Button } from '@ella/ui'
import { toast } from '../../stores/toast-store'
import { api } from '../../lib/api-client'
import { formatRelativeTime, formatBytes } from '../../lib/formatters'
import { useDraftReturnSignedUrl } from '../../hooks/use-draft-return-signed-url'
import type { DraftReturnData, DraftMagicLinkData, DraftVersionData } from '../../lib/api-client'

// Lazy load PDF thumbnail for code splitting
const PdfThumbnail = lazy(() => import('../documents/pdf-thumbnail'))

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
  const [loadingVersion, setLoadingVersion] = useState<number | null>(null)

  // Get signed URL for PDF thumbnail preview
  const { data: signedUrlData, isLoading: isLoadingUrl } = useDraftReturnSignedUrl(draftReturn.id)

  // Copy link to clipboard
  const handleCopy = useCallback(async () => {
    if (!magicLink?.url) return
    await navigator.clipboard.writeText(magicLink.url)
    setCopied(true)
    toast.success(t('draftReturn.linkCopied'))
    setTimeout(() => setCopied(false), 2000)
  }, [magicLink?.url, t])

  // Open shareable link in new tab
  const handleOpenLink = useCallback(() => {
    if (!magicLink?.url) return
    window.open(magicLink.url, '_blank', 'noopener,noreferrer')
  }, [magicLink?.url])

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
      await api.draftReturns.upload(caseId, file)
      toast.success(t('draftReturn.uploadSuccess'))
      onActionComplete()
    } catch {
      toast.error(t('draftReturn.uploadError'))
    } finally {
      setIsUploading(false)
    }
  }, [caseId, t, onActionComplete])

  // View specific version
  const handleViewVersion = useCallback(async (version: number) => {
    setLoadingVersion(version)
    try {
      const result = await api.draftReturns.getVersionSignedUrl(caseId, version)
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error(t('draftReturn.versionLoadError'))
    } finally {
      setLoadingVersion(null)
    }
  }, [caseId, t])

  // Calculate expiry info
  const expiresAt = magicLink?.expiresAt ? new Date(magicLink.expiresAt) : null
  const isExpired = expiresAt ? expiresAt < new Date() : false
  const daysUntilExpiry = expiresAt
    ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="space-y-4">
      {/* Main card */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="flex flex-col lg:flex-row">
          {/* Left: PDF Thumbnail Preview */}
          <div className="lg:w-48 flex-shrink-0 bg-muted/30 border-b lg:border-b-0 lg:border-r border-border">
            <div className="aspect-[3/4] max-h-[200px] lg:max-h-none mx-auto lg:mx-0 w-auto lg:w-full relative flex items-center justify-center p-4">
              {isLoadingUrl ? (
                <div className="flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                  <span className="text-xs text-muted-foreground">{t('draftReturn.loadingPreview')}</span>
                </div>
              ) : signedUrlData?.url ? (
                <Suspense
                  fallback={
                    <div className="w-full h-full flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                    </div>
                  }
                >
                  <div className="w-full h-full rounded-lg overflow-hidden shadow-sm bg-white">
                    <PdfThumbnail url={signedUrlData.url} width={160} />
                  </div>
                </Suspense>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <FileText className="w-12 h-12" />
                  <span className="text-xs font-medium">PDF</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Info and Actions */}
          <div className="flex-1 p-6">
            <div className="flex flex-col h-full">
              {/* File info */}
              <div className="mb-4">
                <h3 className="font-semibold text-lg text-foreground truncate mb-1">
                  {draftReturn.filename}
                </h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                    v{draftReturn.version}
                  </span>
                  <span>{formatBytes(draftReturn.fileSize)}</span>
                  <span>&middot;</span>
                  <span>{t('draftReturn.uploadedBy')} {draftReturn.uploadedBy.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatRelativeTime(draftReturn.uploadedAt, i18n.language)}
                </p>
              </div>

              {/* Link section */}
              {magicLink && !isExpired ? (
                <div className="space-y-4 flex-1">
                  {/* Link status bar */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {t('draftReturn.shareableLink')}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full">
                        {t('draftReturn.active')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
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
                  </div>

                  {/* Link input with actions */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                      <code className="flex-1 text-sm truncate text-foreground/80">
                        {magicLink.url}
                      </code>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      className="gap-1.5 flex-shrink-0"
                      title={t('draftReturn.copyLink')}
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleOpenLink}
                      className="gap-1.5 flex-shrink-0"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {t('draftReturn.openLink')}
                    </Button>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExtend}
                      disabled={isExtending}
                      className="gap-1.5"
                    >
                      {isExtending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                      {t('draftReturn.extend')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRevoke}
                      disabled={isRevoking}
                      className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      {isRevoking ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Link2Off className="w-4 h-4" />
                      )}
                      {t('draftReturn.revoke')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="bg-destructive/10 rounded-lg p-4 flex-1 flex flex-col items-center justify-center">
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
        </div>

        {/* Upload new version - Footer */}
        <div className="px-6 py-4 bg-muted/30 border-t border-border">
          <label className={cn(
            'inline-flex items-center justify-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-all hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer',
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

      {/* Version history - Collapsible card */}
      {versions.length > 1 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <button
            onClick={() => setShowVersions(!showVersions)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              {t('draftReturn.versionHistory')} ({versions.length})
            </span>
            {showVersions ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          {showVersions && (
            <div className="px-5 pb-4 space-y-2">
              {versions.map((v) => (
                <button
                  key={v.version}
                  onClick={() => handleViewVersion(v.version)}
                  disabled={loadingVersion === v.version}
                  className={cn(
                    'w-full flex items-center justify-between py-3 px-4 rounded-lg text-sm transition-colors',
                    'hover:bg-muted/50 cursor-pointer',
                    v.status === 'ACTIVE'
                      ? 'bg-primary/5 border border-primary/20'
                      : 'bg-muted/30 border border-transparent'
                  )}
                >
                  <span className="flex items-center gap-2">
                    {loadingVersion === v.version ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="font-medium">v{v.version}</span>
                    {v.status === 'ACTIVE' && (
                      <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                        {t('draftReturn.current')}
                      </span>
                    )}
                    {v.status === 'SUPERSEDED' && (
                      <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-full">
                        {t('draftReturn.superseded')}
                      </span>
                    )}
                    {v.status === 'REVOKED' && (
                      <span className="px-2 py-0.5 text-xs bg-destructive/10 text-destructive rounded-full">
                        {t('draftReturn.revoked')}
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {formatRelativeTime(v.uploadedAt, i18n.language)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
