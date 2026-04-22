/**
 * SharedDocCard - Per-section card: thumbnail, rename, link bar, version history, delete
 * Orchestrates sub-components. Upload/delete via compact icon actions.
 */
import { useState, useCallback, lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Trash2, Upload, FileText } from 'lucide-react'
import { cn, Button } from '@ella/ui'
import { toast } from '../../stores/toast-store'
import { formatRelativeTime, formatBytes } from '../../lib/formatters'
import { useSharedDocSignedUrl } from '../../hooks/use-shared-doc-signed-url'
import { useSharedDocs } from '../../hooks/use-shared-docs'
import { RenameSectionInline } from './rename-section-inline'
import { SharedDocLinkBar } from './shared-doc-link-bar'
import { SharedDocVersionHistory } from './shared-doc-version-history'
import { DeleteSectionConfirm } from './delete-section-confirm'
import type { SharedDocListItem } from '../../lib/api-client'

const PdfThumbnail = lazy(() => import('../documents/pdf-thumbnail'))

interface SharedDocCardProps {
  document: SharedDocListItem
  caseId: string
}

export function SharedDocCard({ document, caseId }: SharedDocCardProps) {
  const { t, i18n } = useTranslation()
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const { renameSection, isRenaming, deleteSection, isDeleting, uploadVersion, isUploadingVersion } =
    useSharedDocs({ caseId })

  const { data: signedUrlData, isLoading: isLoadingUrl } = useSharedDocSignedUrl(document.id)

  const handleRename = useCallback(
    async (newTitle: string) => {
      await renameSection({ id: document.id, title: newTitle })
    },
    [renameSection, document.id]
  )

  const handleDelete = useCallback(async () => {
    try {
      await deleteSection(document.id)
      toast.success(t('sharedDocs.deleteSuccess'))
      setShowDeleteModal(false)
    } catch {
      toast.error(t('sharedDocs.deleteError'))
    }
  }, [deleteSection, document.id, t])

  const handleUploadNew = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      e.target.value = ''

      if (file.type !== 'application/pdf') {
        toast.error(t('sharedDocs.errorPdfOnly'))
        return
      }
      if (file.size > 50 * 1024 * 1024) {
        toast.error(t('sharedDocs.errorTooLarge'))
        return
      }

      try {
        await uploadVersion({ id: document.id, file })
        toast.success(t('sharedDocs.uploadSuccess'))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('sharedDocs.uploadError'))
      }
    },
    [uploadVersion, document.id, t]
  )

  return (
    <div className="space-y-3">
      <div className="bg-card rounded-xl shadow-sm dark:shadow-none dark:border dark:border-white/[0.06] p-4">
        <div className="flex gap-4">
          {/* Compact thumbnail */}
          <div className="w-20 h-24 flex-shrink-0 rounded-md overflow-hidden bg-muted/40 border border-border/50 flex items-center justify-center">
            {isLoadingUrl ? (
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            ) : signedUrlData?.url ? (
              <Suspense
                fallback={<Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />}
              >
                <div className="w-full h-full bg-white">
                  <PdfThumbnail url={signedUrlData.url} width={80} />
                </div>
              </Suspense>
            ) : (
              <FileText className="w-8 h-8 text-muted-foreground" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <RenameSectionInline
                title={document.title}
                onSave={handleRename}
                isSaving={isRenaming}
                className="flex-1 min-w-0"
              />
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <label
                  className={cn(
                    'inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors',
                    isUploadingVersion && 'opacity-50 pointer-events-none'
                  )}
                  title={t('sharedDocs.uploadNewVersion')}
                >
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handleUploadNew}
                    className="sr-only"
                    disabled={isUploadingVersion}
                  />
                  {isUploadingVersion ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteModal(true)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 w-8 h-8 p-0"
                  aria-label={t('sharedDocs.deleteSection')}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground truncate mt-0.5">{document.filename}</p>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-1.5">
              <span className="inline-flex items-center px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-semibold">
                v{document.version}
              </span>
              <span>{formatBytes(document.fileSize)}</span>
              <span className="text-muted-foreground/50">·</span>
              <span className="truncate">{document.uploadedBy.name}</span>
              <span className="text-muted-foreground/50">·</span>
              <span>{formatRelativeTime(document.uploadedAt, i18n.language)}</span>
            </div>

            <div className="mt-3 pt-3 border-t border-border/50">
              <SharedDocLinkBar
                sectionId={document.id}
                caseId={caseId}
                magicLink={document.magicLink}
                viewCount={document.viewCount}
              />
            </div>
          </div>
        </div>

        {document.version > 1 && (
          <div className="mt-4 pt-3 border-t border-border/50">
            <SharedDocVersionHistory sectionId={document.id} currentVersion={document.version} />
          </div>
        )}
      </div>

      <DeleteSectionConfirm
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title={document.title}
        isLoading={isDeleting}
      />
    </div>
  )
}
