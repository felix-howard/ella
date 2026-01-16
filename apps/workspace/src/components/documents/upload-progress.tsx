/**
 * Upload Progress Component - Floating panel showing processing status
 * Displays when images are being classified or docs are being extracted by AI
 */

import { Sparkles, FileSearch } from 'lucide-react'

interface UploadProgressProps {
  processingCount: number
  extractingCount?: number
}

export function UploadProgress({ processingCount, extractingCount = 0 }: UploadProgressProps) {
  // Don't render if nothing is processing
  if (processingCount === 0 && extractingCount === 0) return null

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
