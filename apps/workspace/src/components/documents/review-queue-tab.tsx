/**
 * ReviewQueueTab - Display documents needing verification
 * Shows docs with PENDING/EXTRACTED/PARTIAL status
 * Each card shows thumbnail, doc type, AI confidence, and verification progress
 */

import { useState } from 'react'
import { Search, FileText, Eye, AlertCircle, Loader2 } from 'lucide-react'
import { cn, Badge, Card } from '@ella/ui'
import { DOC_TYPE_LABELS, AI_CONFIDENCE_THRESHOLDS } from '../../lib/constants'
import { CompactProgressIndicator } from '../ui/progress-indicator'
import { useSignedUrl } from '../../hooks/use-signed-url'
import type { DigitalDoc } from '../../lib/api-client'

export interface ReviewQueueTabProps {
  caseId: string
  docs: DigitalDoc[]
  isLoading?: boolean
  onVerify?: (doc: DigitalDoc) => void
}

// Doc statuses that appear in review queue
const REVIEW_STATUSES = ['PENDING', 'EXTRACTED', 'PARTIAL']

// Status labels in Vietnamese
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ xử lý',
  EXTRACTED: 'Đã trích xuất',
  PARTIAL: 'Thiếu dữ liệu',
}

// Status colors
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: 'bg-warning-light', text: 'text-warning' },
  EXTRACTED: { bg: 'bg-primary-light', text: 'text-primary' },
  PARTIAL: { bg: 'bg-accent-light', text: 'text-accent' },
}

export function ReviewQueueTab({
  caseId,
  docs,
  isLoading,
  onVerify,
}: ReviewQueueTabProps) {
  const [selectedDoc, setSelectedDoc] = useState<DigitalDoc | null>(null)

  if (isLoading) {
    return <ReviewQueueSkeleton />
  }

  // Filter docs needing review
  const reviewDocs = docs.filter((doc) => REVIEW_STATUSES.includes(doc.status))

  if (reviewDocs.length === 0) {
    return (
      <div className="text-center py-12">
        <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
        <h3 className="text-base font-medium text-foreground mb-2">
          Không có tài liệu cần xác minh
        </h3>
        <p className="text-sm text-muted-foreground">
          Tất cả tài liệu đã được xác minh hoặc chưa có tài liệu nào được trích xuất
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {reviewDocs.length} tài liệu cần xác minh
        </p>
      </div>

      {/* Document Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reviewDocs.map((doc) => (
          <ReviewQueueCard
            key={doc.id}
            doc={doc}
            onClick={() => onVerify?.(doc)}
          />
        ))}
      </div>
    </div>
  )
}

interface ReviewQueueCardProps {
  doc: DigitalDoc
  onClick: () => void
}

/**
 * Card showing document needing verification
 * Displays: thumbnail, doc type, AI confidence, verification progress
 */
/** Type guard to safely extract Record from unknown */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Type guard for number */
function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value)
}

function ReviewQueueCard({ doc, onClick }: ReviewQueueCardProps) {
  const statusConfig = STATUS_COLORS[doc.status] || STATUS_COLORS.PENDING
  const statusLabel = STATUS_LABELS[doc.status] || doc.status
  const docLabel = DOC_TYPE_LABELS[doc.docType] || doc.docType

  // Safely extract data with type guards
  const extractedData = isRecord(doc.extractedData) ? doc.extractedData : {}
  const fieldVerifications = isRecord(doc.fieldVerifications) ? doc.fieldVerifications : {}

  // Calculate verification progress
  const totalFields = Object.keys(extractedData).filter(
    (k) => !['aiConfidence', 'rawText'].includes(k)
  ).length
  const verifiedFields = Object.values(fieldVerifications).filter((v) => v !== null).length

  // AI confidence - safely extract with type guard
  const extractedConfidence = extractedData.aiConfidence
  const aiConfidence = doc.aiConfidence ?? (isNumber(extractedConfidence) ? extractedConfidence : 0)
  const confidencePercent = Math.round(aiConfidence * 100)

  return (
    <Card
      className="cursor-pointer hover:border-primary hover:shadow-md transition-all group"
      onClick={onClick}
    >
      <div className="p-4 space-y-3">
        {/* Thumbnail */}
        <div className="aspect-video bg-muted rounded-lg overflow-hidden relative">
          {doc.rawImageId ? (
            <DocThumbnail rawImageId={doc.rawImageId} />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FileText className="w-10 h-10 text-muted-foreground" />
            </div>
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="flex items-center gap-2 text-white text-sm font-medium">
              <Eye className="w-4 h-4" />
              <span>Xác minh</span>
            </div>
          </div>
        </div>

        {/* Document Info */}
        <div className="space-y-2">
          {/* Type and Status Row */}
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className="text-xs truncate">
              {docLabel}
            </Badge>
            <Badge
              className={cn(
                'text-xs',
                statusConfig.bg,
                statusConfig.text
              )}
            >
              {statusLabel}
            </Badge>
          </div>

          {/* AI Confidence */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">AI Confidence</span>
            <span
              className={cn(
                'font-medium',
                confidencePercent >= AI_CONFIDENCE_THRESHOLDS.HIGH * 100 ? 'text-success' : 'text-warning'
              )}
            >
              {confidencePercent}%
            </span>
          </div>

          {/* Verification Progress */}
          {totalFields > 0 && (
            <CompactProgressIndicator
              current={verifiedFields}
              total={totalFields}
              ariaLabel="Tiến độ xác minh"
            />
          )}
        </div>

        {/* Filename */}
        {doc.rawImage?.filename && (
          <p className="text-xs text-muted-foreground truncate">
            {doc.rawImage.filename}
          </p>
        )}
      </div>
    </Card>
  )
}

/**
 * Thumbnail for document using signed URL
 */
function DocThumbnail({ rawImageId }: { rawImageId: string }) {
  const { data, isLoading, error } = useSignedUrl(rawImageId, { staleTime: 55 * 60 * 1000 })

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    )
  }

  if (error || !data?.url) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted">
        <FileText className="w-8 h-8 text-muted-foreground" />
      </div>
    )
  }

  return (
    <img
      src={data.url}
      alt="Document thumbnail"
      className="w-full h-full object-cover"
      loading="lazy"
    />
  )
}

/**
 * Skeleton loader for Review Queue Tab
 */
export function ReviewQueueSkeleton() {
  return (
    <div className="space-y-4">
      {/* Summary Skeleton */}
      <div className="h-5 w-40 bg-muted rounded animate-pulse" />

      {/* Cards Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-4 space-y-3">
            {/* Thumbnail */}
            <div className="aspect-video bg-muted rounded-lg animate-pulse" />

            {/* Info */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <div className="h-5 w-20 bg-muted rounded animate-pulse" />
                <div className="h-5 w-16 bg-muted rounded animate-pulse" />
              </div>
              <div className="flex justify-between">
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                <div className="h-4 w-8 bg-muted rounded animate-pulse" />
              </div>
              <div className="h-2 w-full bg-muted rounded-full animate-pulse" />
            </div>

            {/* Filename */}
            <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
          </Card>
        ))}
      </div>
    </div>
  )
}
