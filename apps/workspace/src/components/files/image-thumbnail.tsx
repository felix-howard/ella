/**
 * ImageThumbnail - Reusable thumbnail component for Files Tab
 * Fetches signed URL and displays image/PDF preview
 */

import { memo, lazy, Suspense } from 'react'
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

/**
 * Thumbnail component that fetches signed URL and displays preview
 * Handles loading, error states, and PDF vs image rendering
 */
export const ImageThumbnail = memo(function ImageThumbnail({
  imageId,
  filename,
  className = 'w-full h-full',
}: ImageThumbnailProps) {
  const { data, isLoading, error } = useSignedUrl(imageId, { staleTime: 55 * 60 * 1000 })
  const isPdf = isPdfFile(filename)

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
          <PdfThumbnail url={data.url} width={120} />
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
    />
  )
})
