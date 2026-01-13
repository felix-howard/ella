/**
 * Raw Image Gallery Component - Displays uploaded images with status indicators
 * Shows image thumbnails, status badges, and quick actions
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@ella/ui'
import {
  Image as ImageIcon,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  HelpCircle,
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from 'lucide-react'
import { DOC_TYPE_LABELS } from '../../lib/constants'
import type { RawImage } from '../../lib/api-client'

// Image status types
type ImageStatus = 'UPLOADED' | 'CLASSIFIED' | 'LINKED' | 'BLURRY' | 'UNCLASSIFIED'

interface RawImageGalleryProps {
  images: RawImage[]
  isLoading?: boolean
  onImageClick?: (image: RawImage) => void
  onClassify?: (image: RawImage) => void
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

export function RawImageGallery({ images, isLoading, onImageClick, onClassify }: RawImageGalleryProps) {
  const [viewerOpen, setViewerOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<RawImage | null>(null)

  const handleImageClick = (image: RawImage) => {
    setSelectedImage(image)
    setViewerOpen(true)
    onImageClick?.(image)
  }

  const closeViewer = () => {
    setViewerOpen(false)
    setSelectedImage(null)
  }

  if (isLoading) {
    return <RawImageGallerySkeleton />
  }

  if (!images.length) {
    return (
      <div className="text-center py-12">
        <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Chưa có ảnh nào được tải lên</p>
      </div>
    )
  }

  // Group by status for filtering
  const statusCounts = images.reduce((acc, img) => {
    const status = img.status as ImageStatus
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {} as Record<ImageStatus, number>)

  return (
    <div className="space-y-4">
      {/* Status Filter Pills */}
      <div className="flex flex-wrap gap-2">
        <StatusPill
          label="Tất cả"
          count={images.length}
          isActive
        />
        {Object.entries(statusCounts).map(([status, count]) => (
          <StatusPill
            key={status}
            label={IMAGE_STATUS_CONFIG[status as ImageStatus]?.label || status}
            count={count}
            color={IMAGE_STATUS_CONFIG[status as ImageStatus]?.color}
          />
        ))}
      </div>

      {/* Image Grid */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {images.map((image) => (
          <ImageCard
            key={image.id}
            image={image}
            onClick={() => handleImageClick(image)}
            onClassify={() => onClassify?.(image)}
          />
        ))}
      </div>

      {/* Image Viewer Modal - key forces remount on image change to reset zoom/rotation */}
      {viewerOpen && selectedImage && (
        <ImageViewer
          key={selectedImage.id}
          image={selectedImage}
          onClose={closeViewer}
        />
      )}
    </div>
  )
}

interface StatusPillProps {
  label: string
  count: number
  color?: string
  isActive?: boolean
}

function StatusPill({ label, count, color = 'text-muted-foreground', isActive }: StatusPillProps) {
  return (
    <button
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors',
        isActive
          ? 'bg-primary text-white'
          : 'bg-muted hover:bg-muted/80'
      )}
    >
      <span className={isActive ? 'text-white' : color}>{label}</span>
      <span className={cn(
        'text-xs px-1.5 py-0.5 rounded-full',
        isActive ? 'bg-white/20 text-white' : 'bg-background text-muted-foreground'
      )}>
        {count}
      </span>
    </button>
  )
}

interface ImageCardProps {
  image: RawImage
  onClick: () => void
  onClassify?: () => void
}

function ImageCard({ image, onClick, onClassify }: ImageCardProps) {
  const status = image.status as ImageStatus
  const config = IMAGE_STATUS_CONFIG[status] || IMAGE_STATUS_CONFIG.UPLOADED
  const Icon = config.icon
  const docType = image.checklistItem?.template?.docType
  const docLabel = docType ? DOC_TYPE_LABELS[docType] : null
  const needsClassify = status === 'UPLOADED' || status === 'UNCLASSIFIED'

  // TODO: Replace placeholder with signed R2 URL when storage service is implemented (Phase INF.4)
  // Security note: Never expose raw R2 keys in production - use time-limited signed URLs
  const imageUrl = image.r2Key
    ? `https://placeholder.pics/svg/200x150/DEDEDE/555555/${encodeURIComponent(image.filename.slice(0, 10))}`
    : null

  return (
    <div
      className="group relative bg-card rounded-xl border overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      {/* Image Thumbnail */}
      <div className="aspect-[4/3] bg-muted relative overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={image.filename}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-muted-foreground" />
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Eye className="w-6 h-6 text-white" />
        </div>

        {/* Status Badge */}
        <div className={cn(
          'absolute top-2 right-2 p-1 rounded-md',
          config.bgColor
        )}>
          <Icon className={cn('w-3.5 h-3.5', config.color)} />
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs text-foreground font-medium truncate">
          {image.filename}
        </p>
        {docLabel && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {docLabel}
          </p>
        )}
        <div className="flex items-center justify-between mt-2">
          <span className={cn('text-xs', config.color)}>
            {config.label}
          </span>
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
        </div>
      </div>
    </div>
  )
}

interface ImageViewerProps {
  image: RawImage
  onClose: () => void
}

function ImageViewer({ image, onClose }: ImageViewerProps) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Note: State resets automatically via key prop on parent mount

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        onClose()
        break
      case '+':
      case '=':
        setZoom((z) => Math.min(3, z + 0.25))
        break
      case '-':
        setZoom((z) => Math.max(0.5, z - 0.25))
        break
      case 'r':
      case 'R':
        setRotation((r) => (r + 90) % 360)
        break
      case '0':
        setZoom(1)
        setRotation(0)
        break
    }
  }, [onClose])

  // Add keyboard event listener and focus trap
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    // Focus the container for keyboard events
    containerRef.current?.focus()

    // Prevent body scroll when modal is open
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = originalOverflow
    }
  }, [handleKeyDown])

  // TODO: Replace placeholder with signed R2 URL when storage service is implemented
  // This is a temporary solution for development/demo purposes
  const imageUrl = image.r2Key
    ? `https://placeholder.pics/svg/800x600/DEDEDE/555555/${encodeURIComponent(image.filename.slice(0, 15))}`
    : null

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Xem ảnh: ${image.filename}`}
      tabIndex={-1}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        aria-label="Đóng"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/10 rounded-full p-2">
        <button
          onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Thu nhỏ (phím -)"
          title="Thu nhỏ (phím -)"
        >
          <ZoomOut className="w-5 h-5 text-white" />
        </button>
        <span className="text-white text-sm px-2 min-w-[4rem] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom(Math.min(3, zoom + 0.25))}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Phóng to (phím +)"
          title="Phóng to (phím +)"
        >
          <ZoomIn className="w-5 h-5 text-white" />
        </button>
        <div className="w-px h-6 bg-white/20 mx-2" />
        <button
          onClick={() => setRotation((r) => (r + 90) % 360)}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Xoay (phím R)"
          title="Xoay (phím R)"
        >
          <RotateCw className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Keyboard Hints */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 text-white/50 text-xs">
        ESC: đóng • +/-: zoom • R: xoay • 0: reset
      </div>

      {/* Image Info */}
      <div className="absolute top-4 left-4 text-white">
        <p className="font-medium">{image.filename}</p>
        <p className="text-sm text-white/70">
          {IMAGE_STATUS_CONFIG[image.status as ImageStatus]?.label || image.status}
        </p>
      </div>

      {/* Main Image */}
      <div className="max-w-[90vw] max-h-[80vh] overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={image.filename}
            className="max-w-full max-h-full object-contain transition-transform"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
          />
        ) : (
          <div className="w-96 h-72 bg-muted/20 flex items-center justify-center rounded-xl">
            <ImageIcon className="w-16 h-16 text-white/50" />
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Skeleton loader for Raw Image Gallery
 */
export function RawImageGallerySkeleton() {
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
