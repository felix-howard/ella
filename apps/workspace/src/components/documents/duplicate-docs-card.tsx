/**
 * DuplicateDocsCard - Grid display of duplicate documents
 * Shows docs where pHash detected duplicate (DUPLICATE status)
 * Actions: Delete or Force Classify (bypass duplicate check)
 */

import { memo, lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { Copy, Trash2, FileSearch, Loader2, Image as ImageIcon, FileText } from 'lucide-react'
import { useSignedUrl } from '../../hooks/use-signed-url'
import { api } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import type { RawImage } from '../../lib/api-client'

// Lazy load PDF thumbnail to reduce bundle size
const LazyPdfThumbnail = lazy(() => import('./pdf-thumbnail'))

export interface DuplicateDocsCardProps {
  rawImages: RawImage[]
  onRefresh: () => void
}

/** Check if file is PDF based on filename */
function isPdfFile(filename: string): boolean {
  return filename.toLowerCase().endsWith('.pdf')
}

/**
 * Card displaying duplicate documents in a grid layout
 * Returns null when no duplicates exist (hides card entirely)
 */
export function DuplicateDocsCard({ rawImages, onRefresh }: DuplicateDocsCardProps) {
  const { t } = useTranslation()
  // Filter to DUPLICATE status only
  const duplicates = rawImages.filter((img) => img.status === 'DUPLICATE')

  // Hide card entirely when no duplicates
  if (duplicates.length === 0) {
    return null
  }

  return (
    <div className="bg-card rounded-xl border p-4">
      {/* Header with count badge */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Copy className="w-5 h-5 text-orange-500" />
          {t('duplicates.title')}
        </h2>
        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-600">
          {duplicates.length}
        </span>
      </div>

      {/* Info text */}
      <p className="text-sm text-muted-foreground mb-3">
        {t('duplicates.description')}
      </p>

      {/* Grid: 6 cols desktop, 5 large tablet, 4 tablet, 3 mobile */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
        {duplicates.map((image) => (
          <DuplicateDocItem key={image.id} image={image} onRefresh={onRefresh} />
        ))}
      </div>
    </div>
  )
}

interface DuplicateDocItemProps {
  image: RawImage
  onRefresh: () => void
}

/**
 * Single duplicate doc thumbnail card with action buttons
 * Memoized to prevent re-renders during polling
 */
const DuplicateDocItem = memo(function DuplicateDocItem({
  image,
  onRefresh,
}: DuplicateDocItemProps) {
  const { t } = useTranslation()
  const [isDeleting, setIsDeleting] = useState(false)
  const [isClassifying, setIsClassifying] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await api.images.delete(image.id)
      toast.success(t('duplicates.deleteSuccess'))
      onRefresh()
    } catch (error) {
      console.error('[DuplicateDocsCard] Delete failed:', error)
      toast.error(t('duplicates.deleteError'))
    } finally {
      setIsDeleting(false)
    }
  }

  const handleClassify = async () => {
    setIsClassifying(true)
    try {
      await api.images.classifyAnyway(image.id)
      toast.success(t('duplicates.classifyingDoc'))
      onRefresh()
    } catch (error) {
      console.error('[DuplicateDocsCard] Classify failed:', error)
      toast.error(t('duplicates.classifyError'))
    } finally {
      setIsClassifying(false)
    }
  }

  return (
    <div
      className={cn(
        'group relative bg-background rounded-lg border overflow-hidden',
        'hover:border-orange-400 hover:shadow-sm transition-all'
      )}
    >
      {/* Thumbnail - compact fixed height */}
      <div className="h-24 bg-muted relative overflow-hidden">
        <DuplicateThumbnail imageId={image.id} filename={image.filename} />

        {/* Duplicate indicator badge */}
        <div className="absolute top-1 right-1 bg-orange-500 text-white text-[9px] px-1.5 py-0.5 rounded">
          {t('duplicates.badge')}
        </div>
      </div>

      {/* Filename - single line with truncation */}
      <div className="px-1.5 py-1">
        <p className="text-[10px] text-foreground truncate" title={image.filename}>
          {image.filename}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex border-t">
        <button
          onClick={handleDelete}
          disabled={isDeleting || isClassifying}
          aria-label={t('duplicates.delete', { filename: image.filename })}
          aria-busy={isDeleting}
          className={cn(
            'flex-1 py-1.5 text-[10px] font-medium transition-colors',
            'hover:bg-red-50 text-red-600 border-r',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'flex items-center justify-center gap-1'
          )}
          title={t('duplicates.deleteTitle')}
        >
          {isDeleting ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Trash2 className="w-3 h-3" />
          )}
          {t('duplicates.delete')}
        </button>
        <button
          onClick={handleClassify}
          disabled={isDeleting || isClassifying}
          aria-label={t('duplicates.classify', { filename: image.filename })}
          aria-busy={isClassifying}
          className={cn(
            'flex-1 py-1.5 text-[10px] font-medium transition-colors',
            'hover:bg-primary/10 text-primary',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'flex items-center justify-center gap-1'
          )}
          title={t('duplicates.classifyTitle')}
        >
          {isClassifying ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <FileSearch className="w-3 h-3" />
          )}
          {t('duplicates.classify')}
        </button>
      </div>
    </div>
  )
})

/**
 * Thumbnail that fetches signed URL on demand
 * Reuses pattern from unclassified-docs-card.tsx
 */
function DuplicateThumbnail({ imageId, filename }: { imageId: string; filename: string }) {
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
      className="w-full h-full object-cover opacity-75"
      loading="lazy"
    />
  )
}
