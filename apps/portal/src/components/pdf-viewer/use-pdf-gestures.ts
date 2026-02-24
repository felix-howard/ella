/**
 * usePdfGestures - Touch gesture hook for PDF navigation
 * Features: swipe for page nav, pinch-to-zoom, double-tap toggle
 * Uses @use-gesture/react for unified gesture handling
 */
import { useGesture } from '@use-gesture/react'
import { useState, useCallback, useRef } from 'react'

const MIN_ZOOM = 1
const MAX_ZOOM = 3
const SWIPE_VELOCITY_THRESHOLD = 0.3

export interface UsePdfGesturesOptions {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export interface UsePdfGesturesReturn {
  bind: ReturnType<typeof useGesture>
  zoom: number
  resetZoom: () => void
}

export function usePdfGestures({
  currentPage,
  totalPages,
  onPageChange,
}: UsePdfGesturesOptions): UsePdfGesturesReturn {
  const [zoom, setZoom] = useState(1)
  const initialZoomRef = useRef(1)

  // Reset zoom to fit-to-width (1x)
  const resetZoom = useCallback(() => {
    setZoom(1)
  }, [])

  // Handle page navigation via swipe
  const handleSwipe = useCallback(
    (direction: number, velocity: number) => {
      // Disable swipe when zoomed - user expects pan instead
      if (zoom > 1) return

      // Require minimum velocity to distinguish from scroll intent
      if (Math.abs(velocity) < SWIPE_VELOCITY_THRESHOLD) return

      if (direction < 0 && currentPage < totalPages) {
        // Swipe left = next page
        onPageChange(currentPage + 1)
      } else if (direction > 0 && currentPage > 1) {
        // Swipe right = previous page
        onPageChange(currentPage - 1)
      }
    },
    [zoom, currentPage, totalPages, onPageChange]
  )

  // Handle double tap to toggle fit/2x zoom
  const handleDoubleTap = useCallback(() => {
    setZoom((prev) => (prev === 1 ? 2 : 1))
  }, [])

  // Handle pinch zoom with bounds
  const handlePinch = useCallback(
    (scale: number, first: boolean) => {
      if (first) {
        initialZoomRef.current = zoom
      }

      // Apply scale relative to initial zoom
      const newZoom = initialZoomRef.current * scale
      // Clamp to bounds
      setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom)))
    },
    [zoom]
  )

  // Combined gesture binding
  const bind = useGesture(
    {
      onDrag: ({ swipe: [swipeX], velocity: [vx] }) => {
        if (swipeX !== 0) {
          handleSwipe(swipeX, vx)
        }
      },
      onPinch: ({ offset: [scale], first }) => {
        handlePinch(scale, first)
      },
      onDoubleClick: () => {
        handleDoubleTap()
      },
    },
    {
      drag: {
        // Enable swipe detection
        swipe: {
          velocity: SWIPE_VELOCITY_THRESHOLD,
        },
        // Prevent default to avoid scroll conflicts
        filterTaps: true,
      },
      pinch: {
        // Scale from 1 to MAX_ZOOM
        scaleBounds: { min: MIN_ZOOM, max: MAX_ZOOM },
      },
    }
  )

  return {
    bind,
    zoom,
    resetZoom,
  }
}
