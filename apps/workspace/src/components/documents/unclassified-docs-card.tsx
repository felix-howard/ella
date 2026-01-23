/**
 * UnclassifiedDocsCard - Grid display of unclassified documents awaiting manual classification
 * Shows docs where AI failed to classify (UPLOADED/UNCLASSIFIED status)
 * Click action opens ManualClassificationModal for manual doc type assignment
 */

import { memo, lazy, Suspense } from 'react'
import { cn } from '@ella/ui'
import { FileQuestion, Loader2, Image as ImageIcon, FileText } from 'lucide-react'
import { useSignedUrl } from '../../hooks/use-signed-url'
import type { RawImage } from '../../lib/api-client'

// Lazy load PDF thumbnail to reduce bundle size
const LazyPdfThumbnail = lazy(() => import('./pdf-thumbnail'))

export interface UnclassifiedDocsCardProps {
  rawImages: RawImage[]
  onClassify: (image: RawImage) => void
}

/** Check if file is PDF based on filename */
function isPdfFile(filename: string): boolean {
  return filename.toLowerCase().endsWith('.pdf')
}

/**
 * Card displaying unclassified documents in a grid layout
 * Includes: UPLOADED, UNCLASSIFIED, and CLASSIFIED docs without checklist item
 * Returns null when no unclassified docs exist (hides card entirely)
 */
export function UnclassifiedDocsCard({ rawImages, onClassify }: UnclassifiedDocsCardProps) {
  // Filter to pending classification: UPLOADED, UNCLASSIFIED, or CLASSIFIED but not linked
  const unclassified = rawImages.filter((img) =>
    ['UPLOADED', 'UNCLASSIFIED'].includes(img.status) ||
    (img.status === 'CLASSIFIED' && !img.checklistItem)
  )

  // Show empty state when no unclassified docs
  if (unclassified.length === 0) {
    return (
      <div className="bg-card rounded-xl border p-4">
        <div className="text-center py-6 text-muted-foreground text-sm">
          Không có tài liệu chờ phân loại
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl border p-4">
      {/* Header with count badge */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <FileQuestion className="w-5 h-5 text-warning" />
          Tài liệu chờ phân loại
        </h2>
        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning-light text-warning">
          {unclassified.length}
        </span>
      </div>

      {/* Grid: 6 cols desktop, 5 large tablet, 4 tablet, 3 mobile */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
        {unclassified.map((image) => (
          <UnclassifiedDocCard key={image.id} image={image} onClick={() => onClassify(image)} />
        ))}
      </div>
    </div>
  )
}

interface UnclassifiedDocCardProps {
  image: RawImage
  onClick: () => void
}

/**
 * Single unclassified doc thumbnail card - compact size
 * Memoized to prevent re-renders during polling
 */
const UnclassifiedDocCard = memo(function UnclassifiedDocCard({
  image,
  onClick,
}: UnclassifiedDocCardProps) {
  return (
    <button
      onClick={onClick}
      aria-label={`Phân loại ${image.filename}`}
      className={cn(
        'group relative bg-background rounded-lg border overflow-hidden',
        'hover:border-primary hover:shadow-sm transition-all cursor-pointer',
        'text-left'
      )}
    >
      {/* Thumbnail - compact fixed height */}
      <div className="h-24 bg-muted relative overflow-hidden">
        <DocThumbnail imageId={image.id} filename={image.filename} />

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-[10px] font-medium text-primary bg-white/90 px-1.5 py-0.5 rounded">
            Phân loại
          </span>
        </div>
      </div>

      {/* Filename - single line with truncation */}
      <div className="px-1.5 py-1">
        <p
          className="text-[10px] text-foreground truncate"
          title={image.filename}
        >
          {image.filename}
        </p>
      </div>
    </button>
  )
})

/**
 * Thumbnail that fetches signed URL on demand
 * Reuses pattern from uploads-tab.tsx
 */
function DocThumbnail({ imageId, filename }: { imageId: string; filename: string }) {
  const { data, isLoading, error } = useSignedUrl(imageId, { staleTime: 55 * 60 * 1000 })
  const isPdf = isPdfFile(filename)

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
      </div>
    )
  }

  if (error || !data?.url) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1">
        {isPdf ? (
          <FileText className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ImageIcon className="w-5 h-5 text-muted-foreground" />
        )}
      </div>
    )
  }

  if (isPdf) {
    return (
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
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
