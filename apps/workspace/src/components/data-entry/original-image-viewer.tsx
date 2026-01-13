/**
 * Original Image Viewer - Expandable image viewer for data entry
 * Shows original document image alongside extracted data
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { cn } from '@ella/ui'
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  X,
  Image as ImageIcon,
} from 'lucide-react'
import type { RawImage } from '../../lib/api-client'

export interface OriginalImageViewerProps {
  image: RawImage | null
  /** Expanded mode (fullscreen-ish) */
  expanded?: boolean
  onExpandToggle?: () => void
  className?: string
}

export function OriginalImageViewer({
  image,
  expanded = false,
  onExpandToggle,
  className,
}: OriginalImageViewerProps) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Note: State resets automatically via key prop on parent mount

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Only handle if container is focused
      if (!containerRef.current?.contains(document.activeElement)) return

      switch (e.key) {
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
        case 'f':
        case 'F':
          e.preventDefault()
          onExpandToggle?.()
          break
      }
    },
    [onExpandToggle]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // TODO: Replace with signed R2 URL
  const imageUrl = image?.r2Key
    ? `https://placeholder.pics/svg/800x600/DEDEDE/555555/${encodeURIComponent(image.filename.slice(0, 15))}`
    : null

  if (!image) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center bg-muted/30 rounded-xl border border-border',
          expanded ? 'h-full' : 'h-64',
          className
        )}
      >
        <ImageIcon className="w-12 h-12 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Chọn tài liệu để xem ảnh gốc</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={cn(
        'flex flex-col bg-card rounded-xl border border-border overflow-hidden',
        'focus:outline-none focus:ring-2 focus:ring-primary',
        expanded && 'fixed inset-4 z-50 shadow-2xl',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{image.filename}</p>
        </div>
        <div className="flex items-center gap-1">
          {/* Zoom Controls */}
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            className="p-1.5 rounded hover:bg-muted transition-colors"
            aria-label="Thu nhỏ"
            title="Thu nhỏ (-)"
          >
            <ZoomOut className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-xs text-muted-foreground w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            className="p-1.5 rounded hover:bg-muted transition-colors"
            aria-label="Phóng to"
            title="Phóng to (+)"
          >
            <ZoomIn className="w-4 h-4 text-muted-foreground" />
          </button>

          <div className="w-px h-4 bg-border mx-1" />

          {/* Rotate */}
          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="p-1.5 rounded hover:bg-muted transition-colors"
            aria-label="Xoay"
            title="Xoay (R)"
          >
            <RotateCw className="w-4 h-4 text-muted-foreground" />
          </button>

          {/* Expand Toggle */}
          {onExpandToggle && (
            <>
              <div className="w-px h-4 bg-border mx-1" />
              <button
                onClick={onExpandToggle}
                className="p-1.5 rounded hover:bg-muted transition-colors"
                aria-label={expanded ? 'Thu nhỏ' : 'Mở rộng'}
                title={expanded ? 'Thu nhỏ (F)' : 'Mở rộng (F)'}
              >
                {expanded ? (
                  <Minimize2 className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Maximize2 className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </>
          )}

          {/* Close (expanded mode only) */}
          {expanded && onExpandToggle && (
            <button
              onClick={onExpandToggle}
              className="p-1.5 rounded hover:bg-muted transition-colors ml-2"
              aria-label="Đóng"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Image Area */}
      <div
        className={cn(
          'flex-1 overflow-auto flex items-center justify-center p-4 bg-muted/10',
          expanded ? '' : 'max-h-96'
        )}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={image.filename}
            className="max-w-full max-h-full object-contain transition-transform"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
            draggable={false}
          />
        ) : (
          <div className="w-full h-48 flex items-center justify-center">
            <ImageIcon className="w-16 h-16 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Footer with keyboard hints */}
      <div className="px-4 py-2 border-t border-border bg-muted/30">
        <p className="text-xs text-muted-foreground text-center">
          +/-: zoom • R: xoay • 0: reset • F: mở rộng
        </p>
      </div>
    </div>
  )
}

/**
 * Inline compact image preview for tight layouts
 */
export interface ImagePreviewProps {
  image: RawImage | null
  onClick?: () => void
  className?: string
}

export function ImagePreview({ image, onClick, className }: ImagePreviewProps) {
  const imageUrl = image?.r2Key
    ? `https://placeholder.pics/svg/200x150/DEDEDE/555555/${encodeURIComponent(image.filename?.slice(0, 10) || 'doc')}`
    : null

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative aspect-[4/3] rounded-lg border border-border overflow-hidden',
        'bg-muted hover:border-primary/50 transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-primary',
        className
      )}
    >
      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt={image?.filename || 'Document'}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center">
            <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ImageIcon className="w-8 h-8 text-muted-foreground" />
        </div>
      )}
    </button>
  )
}
