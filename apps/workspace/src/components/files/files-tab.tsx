/**
 * FilesTab - Main container for document file explorer view
 * Shows all documents grouped by AI-classified category from DB
 */

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import { api, type RawImage, type DigitalDoc, type DocCategory } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { DOC_CATEGORIES, CATEGORY_ORDER, isValidCategory, type DocCategoryKey } from '../../lib/doc-categories'
import { UnclassifiedSection } from './unclassified-section'
import { FileCategorySection } from './file-category-section'
import { EmptyCategoryDropZone } from './empty-category-drop-zone'
import { ManualClassificationModal, VerificationModal } from '../documents'

export interface FilesTabProps {
  caseId: string
}

/**
 * Files Tab - Document explorer view showing all uploaded files
 * Grouped by DB category field, unclassified at top
 */
export function FilesTab({ caseId }: FilesTabProps) {
  const queryClient = useQueryClient()
  const [classifyImage, setClassifyImage] = useState<RawImage | null>(null)
  const [isClassifyModalOpen, setIsClassifyModalOpen] = useState(false)
  const [verifyDoc, setVerifyDoc] = useState<DigitalDoc | null>(null)
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false)
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  // Fetch all raw images for case
  const { data: imagesData, isLoading: imagesLoading } = useQuery({
    queryKey: ['images', caseId],
    queryFn: () => api.cases.getImages(caseId),
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
      toast.success(`Đã chuyển sang "${categoryConfig.labelVi}"`)
      queryClient.invalidateQueries({ queryKey: ['images', caseId] })
    },
    onError: (_error, _vars, context) => {
      if (context?.previousImages) {
        queryClient.setQueryData(['images', caseId], context.previousImages)
      }
      toast.error('Lỗi chuyển danh mục')
    },
  })

  // Fetch digital docs for verification status
  const { data: docsData } = useQuery({
    queryKey: ['docs', caseId],
    queryFn: () => api.cases.getDocs(caseId),
  })

  const docs = docsData?.docs ?? []

  // Memoize images array to maintain stable reference
  const images = useMemo(() => imagesData?.images ?? [], [imagesData?.images])

  // Group images by DB category field (not computed from docType)
  const { unclassified, categorized } = useMemo(() => {
    const unclassified: RawImage[] = []
    const byCategory: Record<DocCategoryKey, RawImage[]> = {
      IDENTITY: [],
      INCOME: [],
      EXPENSE: [],
      ASSET: [],
      EDUCATION: [],
      HEALTHCARE: [],
      OTHER: [],
    }

    for (const img of images) {
      // Unclassified: no category, invalid category, or unclassified/uploaded status
      if (
        !isValidCategory(img.category) ||
        img.status === 'UNCLASSIFIED' ||
        img.status === 'UPLOADED'
      ) {
        unclassified.push(img)
      } else {
        // Use validated DB category field
        byCategory[img.category].push(img)
      }
    }

    return { unclassified, categorized: byCategory }
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

  // Loading state with skeleton
  if (imagesLoading) {
    return <FilesTabSkeleton />
  }

  // Empty state
  if (images.length === 0) {
    return (
      <div className="text-center py-12">
        <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Chưa có tài liệu nào</p>
        <p className="text-sm text-muted-foreground mt-1">
          Khách hàng chưa gửi tài liệu qua portal hoặc tin nhắn
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
      {/* Unclassified Section - Always at top */}
      <UnclassifiedSection images={unclassified} onClassify={handleClassify} />

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
