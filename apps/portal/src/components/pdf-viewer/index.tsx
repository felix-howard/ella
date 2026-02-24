/**
 * PDF Viewer - Mobile-first PDF rendering with react-pdf
 * Features: fit-to-width, DPI scaling, gesture support, auto-hide controls
 * Lazy loaded to avoid bundling react-pdf (~150KB) for non-PDF users
 */
import { pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Configure PDF.js worker from unpkg CDN (matches workspace pattern)
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

export interface PdfViewerProps {
  url: string
  filename: string
}

// Placeholder - will be implemented in Phase 02
export function PdfViewer({ url, filename }: PdfViewerProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-muted-foreground">PDF Viewer loading... {filename}</p>
      <p className="text-xs text-muted-foreground/50">{url}</p>
    </div>
  )
}

export default PdfViewer
