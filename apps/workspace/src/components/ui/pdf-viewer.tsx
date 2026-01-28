/**
 * PdfViewer - High-resolution PDF rendering for crisp zoom
 * Renders at 2x resolution and scales down via CSS for sharp display
 * Lazy loaded to avoid bundling react-pdf (~150KB) for non-PDF users
 */

import { Document, Page, pdfjs } from 'react-pdf'
import { Loader2 } from 'lucide-react'

// Configure PDF.js worker from unpkg (serves npm packages directly)
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

// Render at 2x resolution for crisp display when zoomed
const RENDER_SCALE = 2

export interface PdfViewerProps {
  /** PDF file URL */
  fileUrl: string
  /** Rotation in degrees */
  rotation: number
  /** Current page number */
  currentPage: number
  /** Callback when PDF loads successfully */
  onLoadSuccess: (numPages: number) => void
  /** Callback when PDF fails to load */
  onLoadError: () => void
}

export default function PdfViewer({
  fileUrl,
  rotation,
  currentPage,
  onLoadSuccess,
  onLoadError,
}: PdfViewerProps) {
  const handleLoadSuccess = ({ numPages }: { numPages: number }) => {
    onLoadSuccess(numPages)
  }

  const handleLoadError = (error: Error) => {
    console.error('PDF load error:', error.message)
    onLoadError()
  }

  return (
    <Document
      file={fileUrl}
      onLoadSuccess={handleLoadSuccess}
      onLoadError={handleLoadError}
      loading={
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
        </div>
      }
      className="flex justify-center"
    >
      {/* Render at 2x scale, CSS scales down to 50% for crisp display */}
      <Page
        pageNumber={currentPage}
        scale={RENDER_SCALE}
        rotate={rotation}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        className="shadow-md [&>canvas]:!w-[50%] [&>canvas]:!h-auto"
        loading={
          <div className="w-[400px] h-[550px] bg-muted animate-pulse rounded" />
        }
      />
    </Document>
  )
}
