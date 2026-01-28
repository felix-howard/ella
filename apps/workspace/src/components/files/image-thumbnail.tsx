/**
 * ImageThumbnail - Reusable thumbnail component for Files Tab
 * Fetches signed URL and displays image/PDF preview
 */

import { memo, lazy, Suspense, Component, type ReactNode } from 'react'
import { Loader2, FileText, Image as ImageIcon } from 'lucide-react'
import { useSignedUrl } from '../../hooks/use-signed-url'

// Lazy load PDF thumbnail to reduce bundle size
const LazyPdfThumbnail = lazy(() => import('../documents/pdf-thumbnail'))

// Error boundary for PDF thumbnail failures
interface ErrorBoundaryState {
  hasError: boolean
}

class PdfErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

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

  if (isPdf) {
    const pdfFallback = (
      <div className={`${className} flex items-center justify-center bg-muted`}>
        <FileText className="w-6 h-6 text-muted-foreground" />
      </div>
    )
    return (
      <PdfErrorBoundary fallback={pdfFallback}>
        <Suspense
          fallback={
            <div className={`${className} flex items-center justify-center bg-muted`}>
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
            </div>
          }
        >
          <LazyPdfThumbnail url={data.url} />
        </Suspense>
      </PdfErrorBoundary>
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
