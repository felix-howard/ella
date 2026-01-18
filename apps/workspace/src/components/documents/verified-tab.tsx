/**
 * VerifiedTab - Display verified documents ready for data entry
 * Shows docs with VERIFIED status in a table format
 * Each row shows doc type, verification date, entry progress, and actions
 */

import { useState } from 'react'
import {
  FileText,
  CheckCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react'
import { cn } from '@ella/ui'
import { DOC_TYPE_LABELS } from '../../lib/constants'
import { copyToClipboard, sanitizeText } from '../../lib/formatters'
import type { DigitalDoc } from '../../lib/api-client'

export interface VerifiedTabProps {
  caseId: string
  docs: DigitalDoc[]
  isLoading?: boolean
  onDataEntry?: (doc: DigitalDoc) => void
}

export function VerifiedTab({
  caseId: _caseId,
  docs,
  isLoading,
  onDataEntry,
}: VerifiedTabProps) {
  // caseId reserved for future batch export operations
  void _caseId
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const handleCopy = async (value: string, fieldId: string) => {
    const success = await copyToClipboard(value)
    if (success) {
      setCopiedField(fieldId)
      setTimeout(() => setCopiedField(null), 2000)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  if (isLoading) {
    return <VerifiedTabSkeleton />
  }

  // Filter to verified docs only
  const verifiedDocs = docs.filter((doc) => doc.status === 'VERIFIED')

  if (verifiedDocs.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle
          className="w-12 h-12 text-muted-foreground mx-auto mb-4"
          aria-hidden="true"
        />
        <h3 className="text-base font-medium text-foreground mb-2">
          Chưa có tài liệu đã xác minh
        </h3>
        <p className="text-sm text-muted-foreground">
          Các tài liệu sau khi xác minh sẽ xuất hiện ở đây để nhập liệu vào OltPro
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {verifiedDocs.length} tài liệu đã xác minh
        </p>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        {/* Table Header */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-muted/50 border-b text-sm font-medium text-muted-foreground">
          <div className="col-span-5">Loại tài liệu</div>
          <div className="col-span-4">Ngày xác minh</div>
          <div className="col-span-3 text-right">Thao tác</div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-border">
          {verifiedDocs.map((doc) => (
            <VerifiedDocRow
              key={doc.id}
              doc={doc}
              isExpanded={expandedId === doc.id}
              onToggle={() => toggleExpand(doc.id)}
              onCopy={handleCopy}
              copiedField={copiedField}
              onDataEntry={() => onDataEntry?.(doc)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface VerifiedDocRowProps {
  doc: DigitalDoc
  isExpanded: boolean
  onToggle: () => void
  onCopy: (value: string, fieldId: string) => void
  copiedField: string | null
  onDataEntry?: () => void
}

function VerifiedDocRow({
  doc,
  isExpanded,
  onToggle,
  onCopy,
  copiedField,
  onDataEntry,
}: VerifiedDocRowProps) {
  const docLabel = DOC_TYPE_LABELS[doc.docType] || doc.docType
  const verifiedDate = doc.updatedAt
    ? new Date(doc.updatedAt).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '—'

  // Type guard for safe Record extraction
  const isRecord = (val: unknown): val is Record<string, unknown> =>
    typeof val === 'object' && val !== null && !Array.isArray(val)

  // Get extracted data for expanded view
  const extractedData = isRecord(doc.extractedData) ? doc.extractedData : {}
  const dataFields = Object.keys(extractedData).filter(
    (k) => !['aiConfidence', 'rawText'].includes(k)
  )
  const totalFields = dataFields.length

  return (
    <div className="group">
      {/* Main Row */}
      <div
        className={cn(
          'grid grid-cols-12 gap-4 px-4 py-3 items-center cursor-pointer',
          'hover:bg-muted/30 transition-colors'
        )}
        onClick={onToggle}
      >
        {/* Document Type */}
        <div className="col-span-12 md:col-span-5 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/10">
            <FileText className="w-4 h-4 text-success" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground text-sm truncate">{docLabel}</p>
            {doc.rawImage?.filename && (
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                {doc.rawImage.filename}
              </p>
            )}
          </div>
        </div>

        {/* Verified Date */}
        <div className="col-span-6 md:col-span-4 text-sm text-muted-foreground">
          {verifiedDate}
        </div>

        {/* Actions */}
        <div className="col-span-6 md:col-span-3 flex justify-end items-center gap-2">
          {onDataEntry && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDataEntry()
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
              aria-label="Mở Data Entry"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Nhập liệu
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            aria-label={isExpanded ? 'Thu gọn' : 'Xem chi tiết'}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Content - Extracted Data */}
      {isExpanded && totalFields > 0 && (
        <div className="px-4 pb-4 pt-0">
          <div className="ml-11 p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-foreground">Dữ liệu đã trích xuất</h4>
              {onDataEntry && (
                <button
                  onClick={onDataEntry}
                  className="md:hidden inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-white"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Nhập liệu
                </button>
              )}
            </div>
            <div className="space-y-2">
              {dataFields.map((field) => {
                const value = extractedData[field]
                const formattedValue = formatFieldValue(value)
                const fieldId = `${doc.id}-${field}`

                return (
                  <div
                    key={field}
                    className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
                  >
                    <span className="text-sm text-muted-foreground truncate">
                      {formatFieldLabel(field)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate max-w-[200px]">
                        {formattedValue || '—'}
                      </span>
                      {formattedValue && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onCopy(formattedValue, fieldId)
                          }}
                          className="p-1 rounded hover:bg-muted transition-colors"
                          aria-label={`Copy ${field}`}
                        >
                          {copiedField === fieldId ? (
                            <Check className="w-3.5 h-3.5 text-success" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Format field label from camelCase to readable format
 */
function formatFieldLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

/**
 * Format field value for display with XSS protection
 * Uses DOMParser-based sanitization to properly handle HTML entities
 */
function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  let result: string
  if (typeof value === 'number') {
    result = value >= 100 ? `$${value.toLocaleString()}` : String(value)
  } else {
    result = String(value)
  }
  // Use proper XSS sanitization from formatters
  return sanitizeText(result)
}

/**
 * Skeleton loader for Verified Tab
 */
export function VerifiedTabSkeleton() {
  return (
    <div className="space-y-4">
      {/* Summary Skeleton */}
      <div className="h-5 w-40 bg-muted rounded animate-pulse" />

      {/* Table Skeleton */}
      <div className="bg-card rounded-xl border overflow-hidden">
        {/* Header */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-muted/50 border-b">
          <div className="col-span-5 h-4 bg-muted rounded animate-pulse" />
          <div className="col-span-4 h-4 bg-muted rounded animate-pulse" />
          <div className="col-span-3 h-4 bg-muted rounded animate-pulse" />
        </div>

        {/* Rows */}
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="grid grid-cols-12 gap-4 px-4 py-3 items-center">
              <div className="col-span-12 md:col-span-5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted animate-pulse" />
                <div className="space-y-1.5">
                  <div className="w-24 h-4 bg-muted rounded animate-pulse" />
                  <div className="w-32 h-3 bg-muted rounded animate-pulse" />
                </div>
              </div>
              <div className="col-span-6 md:col-span-4">
                <div className="w-20 h-4 bg-muted rounded animate-pulse" />
              </div>
              <div className="col-span-6 md:col-span-3 flex justify-end gap-2">
                <div className="w-16 h-7 bg-muted rounded-lg animate-pulse" />
                <div className="w-7 h-7 bg-muted rounded-lg animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
