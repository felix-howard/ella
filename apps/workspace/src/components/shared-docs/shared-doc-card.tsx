/**
 * SharedDocCard - Per-section card: thumbnail, rename, link bar, version history, delete
 * Orchestrates sub-components. Upload new version via footer input.
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
    <div className="space-y-4">
      <div className="bg-card rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-white/[0.06] overflow-hidden">
        <div className="flex flex-col lg:flex-row">
          <div className="lg:w-48 flex-shrink-0 bg-gradient-to-br from-muted/40 to-muted/20 border-b lg:border-b-0 lg:border-r border-border/50">
            <div className="aspect-[3/4] max-h-[200px] lg:max-h-none mx-auto lg:mx-0 w-auto lg:w-full relative flex items-center justify-center p-4">
              {isLoadingUrl ? (
                <div className="flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                  <span className="text-xs text-muted-foreground">
                    {t('sharedDocs.loadingPreview')}
                  </span>
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

          <div className="flex-1 p-6">
            <div className="flex flex-col h-full">
              <div className="mb-4">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <RenameSectionInline
                    title={document.title}
                    onSave={handleRename}
                    isSaving={isRenaming}
                    className="flex-1 min-w-0"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteModal(true)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                    aria-label={t('sharedDocs.deleteSection')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground truncate">{document.filename}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mt-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">
                    v{document.version}
                  </span>
                  <span>{formatBytes(document.fileSize)}</span>
                  <span>&middot;</span>
                  <span>
                    {t('sharedDocs.uploadedBy')} {document.uploadedBy.name}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatRelativeTime(document.uploadedAt, i18n.language)}
                </p>
              </div>

              <SharedDocLinkBar
                sectionId={document.id}
                caseId={caseId}
                magicLink={document.magicLink}
                viewCount={document.viewCount}
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-muted/20 border-t border-border/50">
          <label
            className={cn(
              'inline-flex items-center justify-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-all hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer',
              isUploadingVersion && 'opacity-50 pointer-events-none'
            )}
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
            {t('sharedDocs.uploadNewVersion')}
          </label>
        </div>
      </div>

      {document.version > 1 && (
        <SharedDocVersionHistory sectionId={document.id} currentVersion={document.version} />
      )}

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
