/**
 * FilesTab - Main container for document file explorer view
 * Shows all documents grouped by AI-classified category from DB
 */

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import JSZip from 'jszip'
import { Upload, Download, CheckCheck, Loader2 } from 'lucide-react'
import { cn, Button } from '@ella/ui'
import { api, fetchMediaBlobUrl, type RawImage, type DigitalDoc, type DocCategory } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { DOC_CATEGORIES, CATEGORY_ORDER, isValidCategory, type DocCategoryKey } from '../../lib/doc-categories'
import { UnclassifiedSection } from './unclassified-section'
import { FileCategorySection } from './file-category-section'
import { EmptyCategoryDropZone } from './empty-category-drop-zone'
import { SimpleImageViewerModal } from './simple-image-viewer-modal'
import { ManualClassificationModal, VerificationModal } from '../documents'

export interface FilesTabProps {
  caseId: string
  /** Pre-fetched images from parent (optional - for consistent loading with other tabs) */
  images?: RawImage[]
  /** Pre-fetched docs from parent (optional) */
  docs?: DigitalDoc[]
  /** Loading state from parent */
  isLoading?: boolean
}

/**
 * Files Tab - Document explorer view showing all uploaded files
 * Grouped by DB category field, unclassified at top
 */
export function FilesTab({ caseId, images: parentImages, docs: parentDocs, isLoading: parentLoading }: FilesTabProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [classifyImage, setClassifyImage] = useState<RawImage | null>(null)
  const [isClassifyModalOpen, setIsClassifyModalOpen] = useState(false)
  const [verifyDoc, setVerifyDoc] = useState<DigitalDoc | null>(null)
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false)
  const [viewImage, setViewImage] = useState<RawImage | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  // Fetch images only if not provided by parent (backward compatibility)
  const { data: imagesData, isPending: imagesLoading } = useQuery({
    queryKey: ['images', caseId],
    queryFn: () => api.cases.getImages(caseId),
    enabled: !parentImages, // Skip fetch if parent provides data
  })

  // Mutation for changing file category (drag and drop)
  const changeCategoryMutation = useMutation({
    mutationFn: ({ imageId, category }: { imageId: string; category: DocCategory }) =>
      api.images.changeCategory(imageId, category),
    onMutate: async ({ imageId, category }) => {
      await queryClient.cancelQueries({ queryKey: ['images', caseId] })
      const previousImages = queryClient.getQueryData(['images', caseId])

      // Optimistic update
      queryClient.setQueryData(
        ['images', caseId],
        (old: { images: RawImage[] } | undefined) => {
          if (!old) return old
          return {
            ...old,
            images: old.images.map((img) =>
              img.id === imageId ? { ...img, category } : img
            ),
          }
        }
      )

      return { previousImages }
    },
    onSuccess: (_data, { category }) => {
      const categoryConfig = DOC_CATEGORIES[category as DocCategoryKey]
      toast.success(`Đã chuyển sang "${categoryConfig.label}"`)
      queryClient.invalidateQueries({ queryKey: ['images', caseId] })
    },
    onError: (_error, _vars, context) => {
      if (context?.previousImages) {
        queryClient.setQueryData(['images', caseId], context.previousImages)
      }
      toast.error('Lỗi chuyển danh mục')
    },
  })

  // Fetch digital docs only if not provided by parent
  const { data: docsData } = useQuery({
    queryKey: ['docs', caseId],
    queryFn: () => api.cases.getDocs(caseId),
    enabled: !parentDocs, // Skip fetch if parent provides data
  })

  // Use parent data if provided, otherwise use fetched data
  const docs = parentDocs ?? docsData?.docs ?? []

  // Memoize images array - prefer parent data over fetched
  const images = useMemo(
    () => parentImages ?? imagesData?.images ?? [],
    [parentImages, imagesData?.images]
  )

  // Loading state - only show skeleton if parent says loading OR we're fetching without parent data
  const showLoading = parentLoading || (!parentImages && imagesLoading)

  // Group images by DB category field (not computed from docType)
  // "Chờ phân loại" only shows docs still being processed (UPLOADED/PROCESSING)
  // AI-failed docs now go directly to "Khác" (OTHER) category
  const { processing, categorized } = useMemo(() => {
    const processing: RawImage[] = []
    const byCategory: Record<DocCategoryKey, RawImage[]> = {
      IDENTITY: [],
      INCOME: [],
      TAX_RETURNS: [],
      EXPENSE: [],
      ASSET: [],
      EDUCATION: [],
      HEALTHCARE: [],
      OTHER: [],
    }

    for (const img of images) {
      // Processing: still being uploaded or AI is working on it
      if (img.status === 'UPLOADED' || img.status === 'PROCESSING') {
        processing.push(img)
      } else if (isValidCategory(img.category)) {
        // Use validated DB category field
        byCategory[img.category].push(img)
      } else {
        // Fallback: docs without valid category go to OTHER
        byCategory.OTHER.push(img)
      }
    }

    return { processing, categorized: byCategory }
  }, [images])

  // Handlers
  const handleClassify = (image: RawImage) => {
    setClassifyImage(image)
    setIsClassifyModalOpen(true)
  }

  const handleCloseClassifyModal = () => {
    setIsClassifyModalOpen(false)
    setTimeout(() => setClassifyImage(null), 200)
  }

  const handleVerify = (doc: DigitalDoc) => {
    setVerifyDoc(doc)
    setIsVerifyModalOpen(true)
  }

  const handleCloseVerifyModal = () => {
    setIsVerifyModalOpen(false)
    setTimeout(() => setVerifyDoc(null), 200)
  }

  // Handler to view files without DigitalDoc (e.g., PDFs/images in "Other" category)
  const handleViewImage = useCallback((imageId: string) => {
    const image = images.find((img) => img.id === imageId)
    if (image) setViewImage(image)
  }, [images])

  // Handler for drag and drop between categories
  const handleFileDrop = useCallback(
    (imageId: string, targetCategory: DocCategoryKey) => {
      changeCategoryMutation.mutate({ imageId, category: targetCategory })
    },
    [changeCategoryMutation]
  )

  // Track global drag state for showing empty category drop zones
  const handleDragStart = useCallback(() => {
    setIsDraggingFile(true)
  }, [])

  const handleDragEnd = useCallback(() => {
    setIsDraggingFile(false)
  }, [])

  // Batch mark all documents as viewed (removes NEW badges)
  const batchMarkViewedMutation = useMutation({
    mutationFn: (imageIds: string[]) => api.images.batchMarkViewed(imageIds),
    onMutate: async () => {
      // Optimistic update - remove all NEW badges immediately
      await queryClient.cancelQueries({ queryKey: ['images', caseId] })
      const previousImages = queryClient.getQueryData(['images', caseId])

      queryClient.setQueryData(
        ['images', caseId],
        (old: { images: RawImage[] } | undefined) => {
          if (!old) return old
          return {
            ...old,
            images: old.images.map((img) => ({ ...img, isNew: false })),
          }
        }
      )

      return { previousImages }
    },
    onSuccess: (data) => {
      toast.success(t('filesTab.markedAllRead', { count: data.marked }))
    },
    onError: (_error, _vars, context) => {
      // Rollback on error
      if (context?.previousImages) {
        queryClient.setQueryData(['images', caseId], context.previousImages)
      }
      toast.error(t('filesTab.markAllReadError'))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['images', caseId] })
    },
  })

  // Handle download all files as ZIP
  const handleDownloadAll = useCallback(async () => {
    if (images.length === 0) return

    setIsDownloading(true)

    try {
      const zip = new JSZip()
      const usedFilenames = new Map<string, number>()

      // Fetch all files and add to ZIP
      for (const img of images) {
        try {
          // Use fetchMediaBlobUrl which includes Bearer auth token
          const blobUrl = await fetchMediaBlobUrl(`/cases/images/${img.id}/file`)
          const response = await fetch(blobUrl)
          const blob = await response.blob()
          URL.revokeObjectURL(blobUrl)

          // Handle duplicate filenames by adding suffix
          let filename = img.displayName || img.filename
          const count = usedFilenames.get(filename) || 0
          if (count > 0) {
            const ext = filename.lastIndexOf('.')
            filename = ext > 0
              ? `${filename.slice(0, ext)} (${count})${filename.slice(ext)}`
              : `${filename} (${count})`
          }
          usedFilenames.set(img.displayName || img.filename, count + 1)

          zip.file(filename, blob)
        } catch {
          console.warn(`Failed to fetch: ${img.filename}`)
        }
      }

      // Generate ZIP and trigger download
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const zipUrl = URL.createObjectURL(zipBlob)

      const link = document.createElement('a')
      link.href = zipUrl
      link.download = `documents-${new Date().toISOString().slice(0, 10)}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      URL.revokeObjectURL(zipUrl)
      toast.success(t('filesTab.downloadedFiles', { count: images.length }))
    } catch {
      toast.error(t('filesTab.downloadError'))
    } finally {
      setIsDownloading(false)
    }
  }, [images, t])

  // Handle mark all as read
  const handleMarkAllRead = useCallback(() => {
    const newImages = images.filter((img) => img.isNew)
    if (newImages.length === 0) {
      toast.success(t('filesTab.noNewFiles'))
      return
    }
    batchMarkViewedMutation.mutate(newImages.map((img) => img.id))
  }, [images, batchMarkViewedMutation, t])

  // Count new files
  const newFilesCount = useMemo(() => images.filter((img) => img.isNew).length, [images])

  // Loading state - show skeleton only when actually loading
  if (showLoading) {
    return <FilesTabSkeleton />
  }

  // Empty state
  if (images.length === 0) {
    return (
      <div className="text-center py-12">
        <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">{t('filesTab.noFiles')}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {t('filesTab.noFilesDesc')}
        </p>
      </div>
    )
  }

  return (
    <div
      className="space-y-4 pb-64"
      onDragEnter={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Action buttons header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {t('filesTab.filesCount', { count: images.length })}
          {newFilesCount > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded">
              {t('filesTab.newCount', { count: newFilesCount })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Mark all as read button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={batchMarkViewedMutation.isPending || newFilesCount === 0}
            className={cn(
              'gap-1.5',
              newFilesCount === 0 && 'opacity-50'
            )}
          >
            {batchMarkViewedMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCheck className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{t('filesTab.markAllRead')}</span>
          </Button>

          {/* Download all button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadAll}
            disabled={isDownloading}
            className="gap-1.5"
          >
            {isDownloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{t('filesTab.downloadAll')}</span>
          </Button>
        </div>
      </div>
      {/* Processing Section - Shows docs still being processed by AI */}
      <UnclassifiedSection images={processing} />

      {/* Categorized Sections - Using CATEGORY_ORDER for consistent display */}
      {CATEGORY_ORDER.map((categoryKey) => {
        const config = DOC_CATEGORIES[categoryKey]
        const categoryImages = categorized[categoryKey]

        // Show empty drop zone when dragging, or category section if has images
        if (categoryImages.length === 0) {
          // Show drop zone for empty categories when dragging
          if (isDraggingFile) {
            return (
              <EmptyCategoryDropZone
                key={categoryKey}
                categoryKey={categoryKey}
                onFileDrop={handleFileDrop}
              />
            )
          }
          return null
        }

        return (
          <FileCategorySection
            key={categoryKey}
            categoryKey={categoryKey}
            config={config}
            images={categoryImages}
            docs={docs}
            caseId={caseId}
            onVerify={handleVerify}
            onViewImage={handleViewImage}
            onFileDrop={handleFileDrop}
          />
        )
      })}

      {/* Classification Modal */}
      <ManualClassificationModal
        image={classifyImage}
        isOpen={isClassifyModalOpen}
        onClose={handleCloseClassifyModal}
        caseId={caseId}
      />

      {/* Verification Modal */}
      {verifyDoc && (
        <VerificationModal
          doc={verifyDoc}
          isOpen={isVerifyModalOpen}
          onClose={handleCloseVerifyModal}
          caseId={caseId}
        />
      )}

      {/* Simple Image/PDF Viewer for files without DigitalDoc (e.g., "Other" category) */}
      {viewImage && (
        <SimpleImageViewerModal
          imageId={viewImage.id}
          filename={viewImage.filename}
          caseId={caseId}
          onClose={() => setViewImage(null)}
        />
      )}
    </div>
  )
}

/**
 * Loading skeleton for Files Tab
 */
export function FilesTabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Unclassified section skeleton */}
      <div className="bg-muted/30 border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 rounded bg-muted" />
          <div className="w-24 h-4 rounded bg-muted" />
          <div className="w-6 h-4 rounded-full bg-muted" />
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-square rounded-lg bg-muted" />
          ))}
        </div>
      </div>

      {/* Category section skeletons */}
      {[1, 2].map((i) => (
        <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded bg-muted" />
              <div className="w-5 h-5 rounded bg-muted" />
              <div className="w-32 h-4 rounded bg-muted" />
              <div className="w-12 h-4 rounded bg-muted" />
            </div>
            <div className="w-4 h-4 rounded bg-muted" />
          </div>
          <div className="border-t border-border divide-y divide-border">
            {[1, 2].map((j) => (
              <div key={j} className="flex items-center gap-4 p-3">
                <div className="w-12 h-12 rounded-lg bg-muted flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="w-32 h-4 rounded bg-muted" />
                  <div className="w-24 h-3 rounded bg-muted" />
                </div>
                <div className="w-20 h-4 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
