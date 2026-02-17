/**
 * PdfViewerDesktop - Native browser PDF rendering via iframe
 * Zero bundle impact, native text selection, search (Ctrl+F)
 * Desktop only - mobile uses react-pdf (see pdf-viewer.tsx)
 *
 * Note: Firefox ignores #toolbar=0 param - toolbar may still show
 */

import { useRef, useState, useEffect } from 'react'
import { RotateCw, Loader2 } from 'lucide-react'

/** Valid rotation degrees */
export type PdfRotation = 0 | 90 | 180 | 270

export interface PdfViewerDesktopProps {
  /** PDF file URL (must be https:, http:, or blob:) */
  fileUrl: string
  /** Rotation in degrees (0, 90, 180, 270) */
  rotation: PdfRotation
  /** Callback to rotate by 90 degrees */
  onRotate: () => void
  /** Show controls overlay (default true) */
  showControls?: boolean
}

/**
 * Validate PDF URL protocol to prevent XSS via javascript: or data: URIs
 * Returns empty string for invalid URLs (iframe will show blank)
 */
function sanitizePdfUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (!['https:', 'http:', 'blob:'].includes(parsed.protocol)) {
      console.warn('[PdfViewerDesktop] Blocked non-http(s)/blob URL:', parsed.protocol)
      return ''
    }
    return url
  } catch {
    console.warn('[PdfViewerDesktop] Invalid URL:', url)
    return ''
  }
}

/**
 * Calculate transform styles for rotated iframe
 * 90/270deg rotations need scale adjustment to fit container
 */
function getRotationStyles(rotation: PdfRotation, containerRect: DOMRect | null) {
  if (!containerRect || containerRect.height === 0) {
    return { transform: `rotate(${rotation}deg)`, transformOrigin: 'center center' }
  }

  const isRotated90 = rotation === 90 || rotation === 270

  if (isRotated90) {
    // For 90/270deg, scale to fit the swapped aspect ratio
    const aspectRatio = containerRect.width / containerRect.height
    const scale = aspectRatio < 1 ? aspectRatio : 1 / aspectRatio

    return {
      transform: `rotate(${rotation}deg) scale(${scale})`,
      transformOrigin: 'center center',
    }
  }

  return {
    transform: `rotate(${rotation}deg)`,
    transformOrigin: 'center center',
  }
}

export default function PdfViewerDesktop({
  fileUrl,
  rotation,
  onRotate,
  showControls = true,
}: PdfViewerDesktopProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Reset loading state when fileUrl changes
  useEffect(() => {
    setIsLoading(true)
  }, [fileUrl])

  // Track container size for rotation scaling
  useEffect(() => {
    if (!containerRef.current) return

    // Get initial measurement immediately
    setContainerRect(containerRef.current.getBoundingClientRect())

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect
      setContainerRect(new DOMRect(0, 0, rect.width, rect.height))
    })

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Validate and build iframe URL with PDF viewer params
  // #toolbar=0 hides toolbar, #navpanes=0 hides navigation pane
  const sanitizedUrl = sanitizePdfUrl(fileUrl)
  const iframeSrc = sanitizedUrl ? `${sanitizedUrl}#toolbar=0&navpanes=0` : ''

  const rotationStyles = getRotationStyles(rotation, containerRect)

  // Don't render iframe for invalid URLs
  if (!sanitizedUrl) {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-muted/50">
        <p className="text-muted-foreground text-sm">Không thể tải PDF</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      {/* Loading state overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
          <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
        </div>
      )}

      {/* Rotate button overlay */}
      {showControls && (
        <div className="absolute top-2 right-2 z-20">
          <button
            onClick={onRotate}
            className="p-2 rounded-full bg-black/70 hover:bg-black/80 transition-colors"
            aria-label="Xoay"
            title="Xoay (R)"
          >
            <RotateCw className="h-4 w-4 text-white" />
          </button>
        </div>
      )}

      {/* PDF iframe with rotation transform */}
      <div className="w-full h-full" style={rotationStyles}>
        <iframe
          src={iframeSrc}
          className="w-full h-full border-0"
          title="PDF Viewer"
          onLoad={() => setIsLoading(false)}
          sandbox="allow-scripts allow-same-origin"
          allow="fullscreen"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  )
}
