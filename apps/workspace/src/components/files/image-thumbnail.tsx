/**
 * ImageThumbnail - Reusable thumbnail component for Files Tab
 * Fetches signed URL and displays image/PDF preview
 * Auto-retries when R2 file is renamed during classification (404 recovery)
 */

import { memo, lazy, Suspense, useCallback, useRef } from 'react'
import { Loader2, FileText, Image as ImageIcon } from 'lucide-react'
import { useSignedUrl } from '../../hooks/use-signed-url'

// Lazy load PDF thumbnail for code splitting (~150KB savings)
const PdfThumbnail = lazy(() => import('../documents/pdf-thumbnail'))

interface ImageThumbnailProps {
  imageId: string
  filename: string
  className?: string
}

/** Check if file is PDF based on filename */
function isPdfFile(filename: string): boolean {
  return filename.toLowerCase().endsWith('.pdf')
}

// Max retries for image load errors (prevents infinite refetch loops)
const MAX_LOAD_RETRIES = 3

/**
 * Thumbnail component that fetches signed URL and displays preview
 * Handles loading, error states, and PDF vs image rendering.
 * When an image fails to load (e.g., R2 file renamed by classify job),
 * invalidates the signed URL cache and refetches with the updated r2Key.
 */
export const ImageThumbnail = memo(function ImageThumbnail({
  imageId,
  filename,
  className = 'w-full h-full',
}: ImageThumbnailProps) {
  const { data, isLoading, error, invalidateAndRefetch } = useSignedUrl(imageId, { staleTime: 55 * 60 * 1000 })
  const isPdf = isPdfFile(filename)
  const retryCountRef = useRef(0)

  // Handle image/PDF load error: invalidate cached URL and refetch
  // This recovers from 404s caused by R2 file rename during classification
  const handleLoadError = useCallback(() => {
    if (retryCountRef.current < MAX_LOAD_RETRIES) {
      retryCountRef.current += 1
      invalidateAndRefetch()
    }
  }, [invalidateAndRefetch])

  // Only show loading spinner on initial load (no cached data)
  // This prevents flash when switching tabs since URLs are cached
  if (isLoading && !data) {
    return (
      <div className={`${className} flex items-center justify-center`}>
        <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
      </div>
    )
  }

  if (error || !data?.url) {
    return (
      <div className={`${className} flex flex-col items-center justify-center`}>
        {isPdf ? (
          <FileText className="w-6 h-6 text-muted-foreground" />
        ) : (
          <ImageIcon className="w-6 h-6 text-muted-foreground" />
        )}
      </div>
    )
  }

  // PDF files: use lazy-loaded PDF thumbnail with Suspense
  if (isPdf) {
    return (
      <div className={`${className} relative overflow-hidden`}>
        <Suspense
          fallback={
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
            </div>
          }
        >
          <PdfThumbnail url={data.url} width={120} onError={handleLoadError} />
        </Suspense>
      </div>
    )
  }

  return (
    <img
      src={data.url}
      alt={filename}
      className={`${className} object-cover`}
      loading="lazy"
      onError={handleLoadError}
    />
  )
})
