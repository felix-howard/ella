/**
 * Original Image Viewer - Expandable image viewer with pan/zoom for data entry
 * Shows original document image alongside extracted data
 * Features: zoom, pan (drag), rotation, field highlighting support
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
  Move,
  RotateCcw,
} from 'lucide-react'
import type { RawImage } from '../../lib/api-client'

export interface OriginalImageViewerProps {
  image: RawImage | null
  /** Expanded mode (fullscreen-ish) */
  expanded?: boolean
  onExpandToggle?: () => void
  /** Highlighted field key for visual correlation */
  highlightedField?: string | null
  className?: string
}

export function OriginalImageViewer({
  image,
  expanded = false,
  onExpandToggle,
  highlightedField,
  className,
}: OriginalImageViewerProps) {
  // Track the current image ID for resetting view state
  const prevImageIdRef = useRef<string | undefined>(undefined)

  // Initialize state - will be reset when image changes via key prop or manual check
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const imageAreaRef = useRef<HTMLDivElement>(null)

  // Reset view state when image changes (using ref comparison to avoid effect setState)
  if (image?.id !== prevImageIdRef.current) {
    prevImageIdRef.current = image?.id
    // Only reset if we already have non-default values (prevents initial render reset)
    if (zoom !== 1 || rotation !== 0 || pan.x !== 0 || pan.y !== 0) {
      setZoom(1)
      setRotation(0)
      setPan({ x: 0, y: 0 })
    }
  }

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return // Only left click
    setIsPanning(true)
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    e.preventDefault()
  }, [pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return
    setPan({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    })
  }, [isPanning, panStart])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  // Mouse leave handler to stop panning
  const handleMouseLeave = useCallback(() => {
    setIsPanning(false)
  }, [])

  // Wheel zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setZoom((z) => Math.max(0.5, Math.min(4, z + delta)))
    }
  }, [])

  // Double-click to fit/reset
  const handleDoubleClick = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  // Reset all view state
  const resetView = useCallback(() => {
    setZoom(1)
    setRotation(0)
    setPan({ x: 0, y: 0 })
  }, [])

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Only handle if container is focused
      if (!containerRef.current?.contains(document.activeElement)) return

      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault()
          setZoom((z) => Math.min(4, z + 0.25))
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
          resetView()
          break
        case 'f':
        case 'F':
          e.preventDefault()
          onExpandToggle?.()
          break
      }
    },
    [onExpandToggle, resetView]
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
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">{image.filename}</p>
          {highlightedField && (
            <span className="px-2 py-0.5 rounded-full bg-primary-light text-primary text-xs font-medium">
              {highlightedField}
            </span>
          )}
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
            onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
            className="p-1.5 rounded hover:bg-muted transition-colors"
            aria-label="Phóng to"
            title="Phóng to (+)"
          >
            <ZoomIn className="w-4 h-4 text-muted-foreground" />
          </button>

          <div className="w-px h-4 bg-border mx-1" />

          {/* Rotate Controls */}
          <button
            onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
            className="p-1.5 rounded hover:bg-muted transition-colors"
            aria-label="Xoay trái"
            title="Xoay trái"
          >
            <RotateCcw className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="p-1.5 rounded hover:bg-muted transition-colors"
            aria-label="Xoay phải"
            title="Xoay phải (R)"
          >
            <RotateCw className="w-4 h-4 text-muted-foreground" />
          </button>

          <div className="w-px h-4 bg-border mx-1" />

          {/* Reset View */}
          <button
            onClick={resetView}
            className="p-1.5 rounded hover:bg-muted transition-colors"
            aria-label="Reset"
            title="Reset view (0)"
          >
            <Move className="w-4 h-4 text-muted-foreground" />
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

      {/* Image Area with Pan/Zoom */}
      <div
        ref={imageAreaRef}
        className={cn(
          'flex-1 overflow-hidden bg-muted/10 relative',
          isPanning ? 'cursor-grabbing' : 'cursor-grab',
          expanded ? '' : 'max-h-[calc(100vh-300px)]'
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px)`,
          }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={image.filename}
              className="max-w-full max-h-full object-contain transition-transform select-none"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
              }}
              draggable={false}
            />
          ) : (
            <div className="w-full h-48 flex items-center justify-center">
              <ImageIcon className="w-16 h-16 text-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      {/* Footer with keyboard hints */}
      <div className="px-4 py-2 border-t border-border bg-muted/30">
        <p className="text-xs text-muted-foreground text-center">
          Kéo: di chuyển • Ctrl+cuộn: zoom • Double-click: reset • +/-: zoom • R: xoay • 0: reset • F: mở rộng
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
