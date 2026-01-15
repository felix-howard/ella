/**
 * PdfViewer - Internal PDF rendering component for ImageViewer
 * Lazy loaded to avoid bundling react-pdf (~150KB) for non-PDF users
 * Uses cdnjs for PDF.js worker (more reliable than unpkg)
 */

import { Document, Page, pdfjs } from 'react-pdf'
import { Loader2 } from 'lucide-react'

// Configure PDF.js worker from cdnjs (more reliable CDN)
// Note: Using cdnjs with versioned URL for better caching
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`

export interface PdfViewerProps {
  /** PDF file URL */
  fileUrl: string
  /** Zoom level */
  zoom: number
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
  zoom,
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
      <Page
        pageNumber={currentPage}
        scale={zoom}
        rotate={rotation}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        className="shadow-md"
        loading={
          <div className="w-[400px] h-[550px] bg-muted animate-pulse rounded" />
        }
      />
    </Document>
  )
}
