/**
 * Upload Progress Component - Floating panel showing processing status
 * Displays when images are being classified by AI
 */

import { Sparkles } from 'lucide-react'

interface UploadProgressProps {
  processingCount: number
}

export function UploadProgress({ processingCount }: UploadProgressProps) {
  // Don't render if nothing is processing
  if (processingCount === 0) return null

  return (
    <div className="fixed bottom-20 right-6 w-72 bg-card rounded-xl border shadow-lg p-4 z-50">
      <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-warning" />
        Đang xử lý
      </h4>

      <div className="flex items-center gap-3">
        <Sparkles className="w-4 h-4 text-warning animate-pulse flex-shrink-0" />
        <span className="text-sm text-muted-foreground">
          AI đang phân loại {processingCount} ảnh...
        </span>
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        Kết quả sẽ tự động cập nhật
      </p>
    </div>
  )
}
