/**
 * SharedDocVersionHistory - Inline timeline of prior versions
 * Renders as a collapsible list at the bottom of the doc card.
 * Fetches versions on-demand via section detail endpoint when expanded.
 */
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Loader2, ExternalLink } from 'lucide-react'
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

  if (currentVersion <= 1) return null

  return (
    <div>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', isOpen && 'rotate-180')} />
        {t('sharedDocs.versionHistory')} · {currentVersion}
      </button>

      {isOpen && (
        <div className="mt-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ol className="relative ml-1.5 border-l border-border/60 space-y-3 py-1">
              {versions.map((v) => {
                const isActive = v.status === 'ACTIVE'
                const isRevoked = v.status === 'REVOKED'
                const isLoadingThis = loadingVersion === v.version

                return (
                  <li key={v.version} className="relative pl-4">
                    {/* Timeline dot */}
                    <span
                      className={cn(
                        'absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-card',
                        isActive && 'bg-primary',
                        isRevoked && 'bg-destructive/70',
                        !isActive && !isRevoked && 'bg-muted-foreground/40'
                      )}
                    />
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span
                          className={cn(
                            'text-sm font-semibold tabular-nums',
                            isActive ? 'text-foreground' : 'text-muted-foreground'
                          )}
                        >
                          v{v.version}
                        </span>
                        {isActive && (
                          <span className="text-[10px] uppercase tracking-wide font-medium text-primary">
                            {t('sharedDocs.current')}
                          </span>
                        )}
                        {isRevoked && (
                          <span className="text-[10px] uppercase tracking-wide font-medium text-destructive/80">
                            {t('sharedDocs.revoked')}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground truncate">
                          · {formatRelativeTime(v.uploadedAt, i18n.language)}
                        </span>
                      </div>
                      {!isActive && (
                        <button
                          onClick={() => handleViewVersion(v.version)}
                          disabled={isLoadingThis}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 disabled:opacity-50"
                        >
                          {isLoadingThis ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <ExternalLink className="w-3 h-3" />
                          )}
                          {t('sharedDocs.view', 'View')}
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}
