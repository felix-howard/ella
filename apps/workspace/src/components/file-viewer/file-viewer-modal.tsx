/**
 * FileViewerModal - Unified modal viewer for images and PDFs
 * Features: zoom, rotation, page navigation (PDF), keyboard shortcuts
 * Uses react-pdf for PDF rendering, native img for images
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { cn } from '@ella/ui'
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  Image as ImageIcon,
  AlertCircle,
  Download,
} from 'lucide-react'

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

export interface FileViewerModalProps {
  /** File URL to display */
  url: string | null
  /** Filename for display and download */
  filename: string
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback when modal closes */
  onClose: () => void
  /** Optional: Loading state while fetching URL */
  isLoading?: boolean
  /** Optional: Error message if URL fetch failed */
  error?: string | null
}

type FileType = 'image' | 'pdf' | 'unknown'

function getFileType(filename: string): FileType {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif'].includes(ext)) {
    return 'image'
  }
  if (ext === 'pdf') {
    return 'pdf'
  }
  return 'unknown'
}

export function FileViewerModal({
  url,
  filename,
  isOpen,
  onClose,
  isLoading = false,
  error = null,
}: FileViewerModalProps) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const fileType = getFileType(filename)

  // Reset state when modal opens with new file
  useEffect(() => {
    if (isOpen) {
      setZoom(1)
      setRotation(0)
      setCurrentPage(1)
      setNumPages(null)
      setPdfError(null)
    }
  }, [isOpen, url])

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case '+':
        case '=':
          e.preventDefault()
          setZoom((z) => Math.min(3, z + 0.25))
          break
        case '-':
          e.preventDefault()
          setZoom((z) => Math.max(0.5, z - 0.25))
          break
        case 'r':
        case 'R':
          e.preventDefault()
          setRotation((r) => (r + 90) % 360)
          break
        case '0':
          e.preventDefault()
          setZoom(1)
          setRotation(0)
          break
        case 'ArrowLeft':
          if (fileType === 'pdf' && currentPage > 1) {
            e.preventDefault()
            setCurrentPage((p) => p - 1)
          }
          break
        case 'ArrowRight':
          if (fileType === 'pdf' && numPages && currentPage < numPages) {
            e.preventDefault()
            setCurrentPage((p) => p + 1)
          }
          break
      }
    },
    [isOpen, onClose, fileType, currentPage, numPages]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      containerRef.current?.focus()
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isOpen])

  const handlePdfLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setPdfError(null)
  }

  const handlePdfLoadError = (error: Error) => {
    console.error('PDF load error:', error)
    setPdfError('Không thể tải file PDF')
  }

  const handleDownload = () => {
    if (url) {
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.target = '_blank'
      a.click()
    }
  }

  if (!isOpen) return null

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black/90 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={`Xem file: ${filename}`}
      tabIndex={-1}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/50">
        <div className="flex items-center gap-3 min-w-0">
          {fileType === 'pdf' ? (
            <FileText className="w-5 h-5 text-white flex-shrink-0" />
          ) : (
            <ImageIcon className="w-5 h-5 text-white flex-shrink-0" />
          )}
          <span className="text-white font-medium truncate">{filename}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Download button */}
          {url && !isLoading && !error && (
            <button
              onClick={handleDownload}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Tải xuống"
              title="Tải xuống"
            >
              <Download className="w-5 h-5 text-white" />
            </button>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Đóng"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        {isLoading ? (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-white animate-spin" />
            <p className="text-white/70">Đang tải file...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-4 text-center max-w-md">
            <AlertCircle className="w-12 h-12 text-red-400" />
            <p className="text-white font-medium">Không thể tải file</p>
            <p className="text-white/70 text-sm">{error}</p>
          </div>
        ) : !url ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="w-12 h-12 text-yellow-400" />
            <p className="text-white font-medium">File không khả dụng</p>
            <p className="text-white/70 text-sm">
              Không có URL để hiển thị file này
            </p>
          </div>
        ) : fileType === 'pdf' ? (
          <div className="max-w-full">
            {pdfError ? (
              <div className="flex flex-col items-center gap-4 text-center">
                <AlertCircle className="w-12 h-12 text-red-400" />
                <p className="text-white font-medium">{pdfError}</p>
              </div>
            ) : (
              <Document
                file={url}
                onLoadSuccess={handlePdfLoadSuccess}
                onLoadError={handlePdfLoadError}
                loading={
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
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
                  className="shadow-2xl"
                  loading={
                    <div className="w-[600px] h-[800px] bg-white/10 animate-pulse rounded" />
                  }
                />
              </Document>
            )}
          </div>
        ) : fileType === 'image' ? (
          <img
            src={url}
            alt={filename}
            className="max-w-full max-h-full object-contain transition-transform shadow-2xl"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
            draggable={false}
          />
        ) : (
          <div className="flex flex-col items-center gap-4 text-center">
            <FileText className="w-12 h-12 text-white/50" />
            <p className="text-white font-medium">Định dạng không được hỗ trợ</p>
            <p className="text-white/70 text-sm">
              Không thể xem trước file này. Bạn có thể tải xuống để xem.
            </p>
            {url && (
              <button
                onClick={handleDownload}
                className="mt-2 px-4 py-2 bg-primary text-white rounded-full hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Tải xuống
              </button>
            )}
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-center gap-4 px-4 py-3 bg-black/50">
        {/* Zoom controls */}
        <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Thu nhỏ"
            title="Thu nhỏ (-)"
          >
            <ZoomOut className="w-4 h-4 text-white" />
          </button>
          <span className="text-white text-sm min-w-[4rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Phóng to"
            title="Phóng to (+)"
          >
            <ZoomIn className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Rotate button */}
        <button
          onClick={() => setRotation((r) => (r + 90) % 360)}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Xoay"
          title="Xoay (R)"
        >
          <RotateCw className="w-4 h-4 text-white" />
        </button>

        {/* PDF page navigation */}
        {fileType === 'pdf' && numPages && numPages > 1 && (
          <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Trang trước"
              title="Trang trước (←)"
            >
              <ChevronLeft className="w-4 h-4 text-white" />
            </button>
            <span className="text-white text-sm min-w-[5rem] text-center">
              {currentPage} / {numPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              disabled={currentPage >= numPages}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Trang sau"
              title="Trang sau (→)"
            >
              <ChevronRight className="w-4 h-4 text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Keyboard hints */}
      <div className="text-center py-2 bg-black/30">
        <p className="text-white/50 text-xs">
          ESC: đóng • +/-: zoom • R: xoay • 0: reset
          {fileType === 'pdf' && numPages && numPages > 1 && ' • ←/→: chuyển trang'}
        </p>
      </div>
    </div>
  )
}
