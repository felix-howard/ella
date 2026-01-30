/**
 * PDF Thumbnail Component - Lazy-loaded PDF preview
 * Renders first page of PDF as a small thumbnail
 * Isolated in separate file for code-splitting (~150KB savings)
 */

import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { FileText, Loader2 } from 'lucide-react'

// Set up PDF.js worker - using unpkg which serves npm packages directly
// This ensures exact version match with the bundled pdfjs-dist
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

export interface PdfThumbnailProps {
  /** URL of the PDF file */
  url: string
  /** Width of the thumbnail in pixels (default: 180) */
  width?: number
  /** Called when PDF fails to load (e.g., 404 from renamed R2 file) */
  onError?: () => void
}

/**
 * PDF Thumbnail - Renders first page of PDF as preview
 */
export default function PdfThumbnail({ url, width = 180, onError }: PdfThumbnailProps) {
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  if (hasError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-muted">
        <FileText className="w-8 h-8 text-red-400" />
        <span className="text-[10px] text-muted-foreground text-center px-2">PDF</span>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-white overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
        </div>
      )}
      <Document
        file={url}
        onLoadSuccess={() => setIsLoading(false)}
        onLoadError={() => {
          setHasError(true)
          setIsLoading(false)
          onError?.()
        }}
        loading={null}
        className="flex items-center justify-center"
      >
        <Page
          pageNumber={1}
          width={width}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          loading={null}
          className="shadow-sm"
        />
      </Document>
    </div>
  )
}
