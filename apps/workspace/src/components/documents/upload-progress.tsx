/**
 * Upload Progress Component - Floating panel showing processing status
 * Displays when images are being classified or docs are being extracted by AI
 * Auto-hides after 30 seconds of no change to handle stuck processing states
 */

import { useState, useEffect, useRef } from 'react'
import { Sparkles, FileSearch } from 'lucide-react'

interface UploadProgressProps {
  processingCount: number
  extractingCount?: number
}

// Hide notification after this many seconds of unchanged counts
const STALE_TIMEOUT_MS = 30000

export function UploadProgress({ processingCount, extractingCount = 0 }: UploadProgressProps) {
  const [isStale, setIsStale] = useState(false)
  const prevCountsRef = useRef({ processing: 0, extracting: 0 })
  const staleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const totalCount = processingCount + extractingCount

  // Reset staleness when counts change
  useEffect(() => {
    const prevTotal = prevCountsRef.current.processing + prevCountsRef.current.extracting
    const currentTotal = totalCount

    // If counts changed (including going to 0), reset staleness
    if (currentTotal !== prevTotal) {
      setIsStale(false)

      // Clear existing timeout
      if (staleTimeoutRef.current) {
        clearTimeout(staleTimeoutRef.current)
        staleTimeoutRef.current = null
      }

      // Start new timeout only if we have processing items
      if (currentTotal > 0) {
        staleTimeoutRef.current = setTimeout(() => {
          setIsStale(true)
        }, STALE_TIMEOUT_MS)
      }
    }

    prevCountsRef.current = { processing: processingCount, extracting: extractingCount }

    // Cleanup timeout on unmount
    return () => {
      if (staleTimeoutRef.current) {
        clearTimeout(staleTimeoutRef.current)
      }
    }
  }, [processingCount, extractingCount, totalCount])

  // Don't render if nothing is processing or if state is stale
  if (totalCount === 0 || isStale) return null

  return (
    <div className="fixed bottom-20 right-6 w-80 bg-card rounded-xl border shadow-lg p-4 z-50">
      <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-warning" />
        AI đang xử lý
      </h4>

      <div className="space-y-2">
        {processingCount > 0 && (
          <div className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-warning animate-pulse flex-shrink-0" />
            <span className="text-sm text-muted-foreground">
              Đang phân loại {processingCount} tài liệu...
            </span>
          </div>
        )}

        {extractingCount > 0 && (
          <div className="flex items-center gap-3">
            <FileSearch className="w-4 h-4 text-info animate-pulse flex-shrink-0" />
            <span className="text-sm text-muted-foreground">
              Đang đọc và trích xuất {extractingCount} tài liệu...
            </span>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        Kết quả sẽ tự động cập nhật
      </p>
    </div>
  )
}
