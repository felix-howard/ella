/**
 * SharedDocVersionHistory - Collapsible per-section version list
 * Fetches versions on-demand via section detail endpoint when expanded.
 */
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Clock, ChevronDown, ChevronUp, Loader2, Download } from 'lucide-react'
import { cn } from '@ella/ui'
import { toast } from '../../stores/toast-store'
import { api } from '../../lib/api-client'
import { formatRelativeTime } from '../../lib/formatters'

interface SharedDocVersionHistoryProps {
  sectionId: string
  currentVersion: number
}

export function SharedDocVersionHistory({ sectionId, currentVersion }: SharedDocVersionHistoryProps) {
  const { t, i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [loadingVersion, setLoadingVersion] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['shared-doc-detail', sectionId],
    queryFn: () => api.sharedDocs.get(sectionId),
    enabled: isOpen,
    staleTime: 30_000,
  })

  const versions = data?.versions ?? []

  const handleViewVersion = useCallback(
    async (version: number) => {
      setLoadingVersion(version)
      try {
        const result = await api.sharedDocs.getVersionSignedUrl(sectionId, version)
        window.open(result.url, '_blank', 'noopener,noreferrer')
      } catch {
        toast.error(t('sharedDocs.versionLoadError'))
      } finally {
        setLoadingVersion(null)
      }
    },
    [sectionId, t]
  )

  if (currentVersion <= 1 && !isOpen) {
    return null
  }

  return (
    <div className="bg-card rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-white/[0.06] overflow-hidden">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-foreground hover:bg-muted/30 transition-all duration-200"
      >
        <span className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          {t('sharedDocs.versionHistory')} ({currentVersion})
        </span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {isOpen && (
        <div className="px-5 pb-4 space-y-2">
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoading &&
            versions.map((v) => (
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
                      {t('sharedDocs.current')}
                    </span>
                  )}
                  {v.status === 'SUPERSEDED' && (
                    <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-full">
                      {t('sharedDocs.superseded')}
                    </span>
                  )}
                  {v.status === 'REVOKED' && (
                    <span className="px-2 py-0.5 text-xs bg-destructive/10 text-destructive rounded-full">
                      {t('sharedDocs.revoked')}
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
  )
}
