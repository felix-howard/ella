/**
 * UploadsTab - Display uploaded raw images with filtering
 * Refactored from RawImageGallery with filter pills and status-based views
 * Shows images that haven't been linked to digital docs yet
 */

import { useState, memo, useRef, useEffect, lazy, Suspense } from 'react'
import { cn } from '@ella/ui'
import {
  Image as ImageIcon,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  HelpCircle,
  Loader2,
  FileText,
} from 'lucide-react'
import { DOC_TYPE_LABELS, getConfidenceLevel, AI_CONFIDENCE_THRESHOLDS } from '../../lib/constants'
import { FileViewerModal } from '../file-viewer'
import { useSignedUrl } from '../../hooks/use-signed-url'
import type { RawImage } from '../../lib/api-client'

// Lazy load PDF thumbnail component to reduce initial bundle size (~150KB savings)
const LazyPdfThumbnail = lazy(() => import('./pdf-thumbnail'))

/** Check if file is a PDF based on filename */
function isPdfFile(filename: string): boolean {
  return filename.toLowerCase().endsWith('.pdf')
}

// Filter types for the tab
type UploadFilter = 'all' | 'processing' | 'needs_class' | 'blurry'

// Image status types
type ImageStatus = 'UPLOADED' | 'PROCESSING' | 'CLASSIFIED' | 'LINKED' | 'BLURRY' | 'UNCLASSIFIED'

export interface UploadsTabProps {
  caseId: string
  images: RawImage[]
  isLoading?: boolean
  onClassify?: (image: RawImage) => void
  onReviewClassification?: (image: RawImage) => void
}

// Status configuration for UI display
const IMAGE_STATUS_CONFIG: Record<ImageStatus, {
  label: string
  icon: typeof CheckCircle
  color: string
  bgColor: string
}> = {
  UPLOADED: {
    label: 'Đã tải lên',
    icon: Clock,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
  PROCESSING: {
    label: 'Đang phân loại',
    icon: Loader2,
    color: 'text-primary',
    bgColor: 'bg-primary-light',
  },
  CLASSIFIED: {
    label: 'Đã phân loại',
    icon: CheckCircle,
    color: 'text-primary',
    bgColor: 'bg-primary-light',
  },
  LINKED: {
    label: 'Đã liên kết',
    icon: CheckCircle,
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  BLURRY: {
    label: 'Ảnh mờ',
    icon: AlertTriangle,
    color: 'text-warning',
    bgColor: 'bg-warning-light',
  },
  UNCLASSIFIED: {
    label: 'Chưa phân loại',
    icon: HelpCircle,
    color: 'text-error',
    bgColor: 'bg-error-light',
  },
}

// Filter labels in Vietnamese
const FILTER_LABELS: Record<UploadFilter, string> = {
  all: 'Tất cả',
  processing: 'Đang xử lý',
  needs_class: 'Cần phân loại',
  blurry: 'Mờ/Lỗi',
}

export function UploadsTab({
  caseId: _caseId,
  images,
  isLoading,
  onClassify,
  onReviewClassification,
}: UploadsTabProps) {
  // caseId reserved for future bulk operations
  void _caseId
  const [filter, setFilter] = useState<UploadFilter>('all')
  const [viewerOpen, setViewerOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<RawImage | null>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timeout on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  // Fetch signed URL when an image is selected
  const { data: signedUrlData, isLoading: isUrlLoading, error: urlError } = useSignedUrl(
    selectedImage?.id ?? null,
    { enabled: viewerOpen && !!selectedImage }
  )

  const handleImageClick = (image: RawImage) => {
    setSelectedImage(image)
    setViewerOpen(true)
  }

  const closeViewer = () => {
    setViewerOpen(false)
    // Clear previous timeout if exists
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
    }
    closeTimeoutRef.current = setTimeout(() => setSelectedImage(null), 200)
  }

  if (isLoading) {
    return <UploadsTabSkeleton />
  }

  // Filter images that belong in Uploads tab (exclude LINKED status)
  const uploadImages = images.filter((img) => img.status !== 'LINKED')

  // Apply sub-filter
  const filteredImages = uploadImages.filter((img) => {
    if (filter === 'all') return true
    if (filter === 'processing') return img.status === 'PROCESSING'
    if (filter === 'needs_class') {
      return (
        ['UNCLASSIFIED', 'CLASSIFIED'].includes(img.status) &&
        (img.aiConfidence ?? 0) < AI_CONFIDENCE_THRESHOLDS.HIGH
      )
    }
    if (filter === 'blurry') {
      return img.status === 'BLURRY' || img.reuploadRequested
    }
    return true
  })

  // Count for each filter
  const filterCounts: Record<UploadFilter, number> = {
    all: uploadImages.length,
    processing: uploadImages.filter((img) => img.status === 'PROCESSING').length,
    needs_class: uploadImages.filter(
      (img) =>
        ['UNCLASSIFIED', 'CLASSIFIED'].includes(img.status) &&
        (img.aiConfidence ?? 0) < AI_CONFIDENCE_THRESHOLDS.HIGH
    ).length,
    blurry: uploadImages.filter(
      (img) => img.status === 'BLURRY' || img.reuploadRequested
    ).length,
  }

  if (uploadImages.length === 0) {
    return (
      <div className="text-center py-12">
        <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Chưa có ảnh nào được tải lên</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter Pills */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc ảnh theo trạng thái">
        {(Object.keys(FILTER_LABELS) as UploadFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            aria-label={`${FILTER_LABELS[f]}: ${filterCounts[f]} ảnh`}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors',
              filter === f
                ? 'bg-primary text-white'
                : 'bg-muted hover:bg-muted/80 text-foreground'
            )}
          >
            <span>{FILTER_LABELS[f]}</span>
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded-full',
                filter === f
                  ? 'bg-white/20 text-white'
                  : 'bg-background text-muted-foreground'
              )}
            >
              {filterCounts[f]}
            </span>
          </button>
        ))}
      </div>

      {/* Image Grid */}
      {filteredImages.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Không có ảnh nào trong bộ lọc này
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filteredImages.map((image) => (
            <UploadImageCard
              key={image.id}
              image={image}
              onClick={() => handleImageClick(image)}
              onClassify={() => onClassify?.(image)}
              onReviewClassification={() => onReviewClassification?.(image)}
            />
          ))}
        </div>
      )}

      {/* File Viewer Modal */}
      <FileViewerModal
        url={signedUrlData?.url ?? null}
        filename={selectedImage?.filename ?? ''}
        isOpen={viewerOpen}
        onClose={closeViewer}
        isLoading={isUrlLoading}
        error={urlError ? (urlError as Error).message : null}
      />
    </div>
  )
}

interface UploadImageCardProps {
  image: RawImage
  onClick: () => void
  onClassify?: () => void
  onReviewClassification?: () => void
}

/**
 * Memoized ImageCard to prevent unnecessary re-renders during polling
 */
const UploadImageCard = memo(function UploadImageCard({
  image,
  onClick,
  onClassify,
  onReviewClassification,
}: UploadImageCardProps) {
  const status = image.status as ImageStatus
  const config = IMAGE_STATUS_CONFIG[status] || IMAGE_STATUS_CONFIG.UPLOADED
  const Icon = config.icon
  const docType = image.classifiedType || image.checklistItem?.template?.docType
  const docLabel = docType ? DOC_TYPE_LABELS[docType] : null
  const needsClassify = status === 'UPLOADED' || status === 'UNCLASSIFIED'
  const isProcessing = status === 'PROCESSING'

  // Confidence badge - show for classified images
  const showConfidenceBadge = status === 'CLASSIFIED' && image.aiConfidence !== null
  const confidenceLevel = showConfidenceBadge ? getConfidenceLevel(image.aiConfidence) : null

  // Show review button for medium/low confidence classified images
  const needsReview = status === 'CLASSIFIED' && image.aiConfidence !== null && image.aiConfidence < AI_CONFIDENCE_THRESHOLDS.HIGH

  return (
    <div
      className={cn(
        'group relative bg-card rounded-xl border overflow-hidden cursor-pointer hover:shadow-md transition-shadow',
        isProcessing && 'animate-pulse'
      )}
      onClick={onClick}
    >
      {/* Image Thumbnail */}
      <div className="aspect-[4/3] bg-muted relative overflow-hidden">
        <ImageThumbnail imageId={image.id} filename={image.filename} />

        {/* Processing Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <span className="text-xs text-muted-foreground">Đang phân loại...</span>
            </div>
          </div>
        )}

        {/* Hover Overlay */}
        {!isProcessing && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Eye className="w-6 h-6 text-white" />
          </div>
        )}

        {/* Confidence Badge - Top Left */}
        {showConfidenceBadge && confidenceLevel && (
          <div
            className={cn(
              'absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium',
              confidenceLevel.bg,
              confidenceLevel.color
            )}
          >
            {Math.round(image.aiConfidence! * 100)}%
          </div>
        )}

        {/* Status Badge - Top Right */}
        <div className={cn('absolute top-2 right-2 p-1 rounded-md', config.bgColor)}>
          <Icon
            className={cn('w-3.5 h-3.5', config.color, isProcessing && 'animate-spin')}
          />
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs text-foreground font-medium truncate">{image.filename}</p>
        {docLabel && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{docLabel}</p>
        )}
        <div className="flex items-center justify-between mt-2">
          <span className={cn('text-xs', config.color)}>{config.label}</span>
          {needsClassify && onClassify && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClassify()
              }}
              className="text-xs text-primary hover:text-primary-dark"
            >
              Phân loại
            </button>
          )}
          {needsReview && onReviewClassification && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onReviewClassification()
              }}
              className="text-xs text-warning hover:text-warning/80"
            >
              Xác minh
            </button>
          )}
        </div>
      </div>
    </div>
  )
})

/**
 * Thumbnail that fetches signed URL on demand
 */
function ImageThumbnail({ imageId, filename }: { imageId: string; filename: string }) {
  const { data, isLoading, error } = useSignedUrl(imageId, { staleTime: 55 * 60 * 1000 })
  const isPdf = isPdfFile(filename)

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    )
  }

  if (error || !data?.url) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1">
        {isPdf ? (
          <FileText className="w-8 h-8 text-muted-foreground" />
        ) : (
          <ImageIcon className="w-8 h-8 text-muted-foreground" />
        )}
        <span className="text-[10px] text-muted-foreground text-center px-2 truncate max-w-full">
          {filename.slice(0, 15)}
        </span>
      </div>
    )
  }

  if (isPdf) {
    return (
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          </div>
        }
      >
        <LazyPdfThumbnail url={data.url} />
      </Suspense>
    )
  }

  return (
    <img
      src={data.url}
      alt={filename}
      className="w-full h-full object-cover"
      loading="lazy"
    />
  )
}

/**
 * Skeleton loader for Uploads Tab
 */
export function UploadsTabSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filter Pills Skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-20 bg-muted rounded-full animate-pulse" />
        ))}
      </div>

      {/* Image Grid Skeleton */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl border overflow-hidden">
            <div className="aspect-[4/3] bg-muted animate-pulse" />
            <div className="p-3 space-y-2">
              <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
