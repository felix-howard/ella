/**
 * Digital Doc Table Component - Table view of extracted/OCR documents
 * Shows document type, status, extracted data preview, and actions
 */

import { useState } from 'react'
import { cn } from '@ella/ui'
import {
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  Eye,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { DOC_TYPE_LABELS, UI_TEXT } from '../../lib/constants'
import { copyToClipboard } from '../../lib/formatters'
import type { DigitalDoc } from '../../lib/api-client'

// Digital doc status types
type DocStatus = 'EXTRACTED' | 'VERIFIED' | 'PARTIAL' | 'FAILED'

interface DigitalDocTableProps {
  docs: DigitalDoc[]
  isLoading?: boolean
  onDocClick?: (doc: DigitalDoc) => void
  onVerify?: (doc: DigitalDoc) => void
}

// Status configuration
const DOC_STATUS_CONFIG: Record<DocStatus, {
  label: string
  icon: typeof CheckCircle
  color: string
  bgColor: string
}> = {
  EXTRACTED: {
    label: 'Đã trích xuất',
    icon: Clock,
    color: 'text-primary',
    bgColor: 'bg-primary-light',
  },
  VERIFIED: {
    label: 'Đã xác minh',
    icon: CheckCircle,
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  PARTIAL: {
    label: 'Thiếu dữ liệu',
    icon: AlertCircle,
    color: 'text-warning',
    bgColor: 'bg-warning-light',
  },
  FAILED: {
    label: 'Lỗi OCR',
    icon: AlertCircle,
    color: 'text-error',
    bgColor: 'bg-error-light',
  },
}

export function DigitalDocTable({ docs, isLoading, onDocClick, onVerify }: DigitalDocTableProps) {
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
    return <DigitalDocTableSkeleton />
  }

  if (!docs.length) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Chưa có tài liệu nào được trích xuất</p>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl border overflow-hidden">
      {/* Table Header */}
      <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-muted/50 border-b text-sm font-medium text-muted-foreground">
        <div className="col-span-4">Loại tài liệu</div>
        <div className="col-span-3">Trạng thái</div>
        <div className="col-span-3">Cập nhật</div>
        <div className="col-span-2 text-right">Thao tác</div>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-border">
        {docs.map((doc) => (
          <DocRow
            key={doc.id}
            doc={doc}
            isExpanded={expandedId === doc.id}
            onToggle={() => toggleExpand(doc.id)}
            onCopy={handleCopy}
            copiedField={copiedField}
            onDocClick={onDocClick}
            onVerify={onVerify}
          />
        ))}
      </div>
    </div>
  )
}

interface DocRowProps {
  doc: DigitalDoc
  isExpanded: boolean
  onToggle: () => void
  onCopy: (value: string, fieldId: string) => void
  copiedField: string | null
  onDocClick?: (doc: DigitalDoc) => void
  onVerify?: (doc: DigitalDoc) => void
}

function DocRow({
  doc,
  isExpanded,
  onToggle,
  onCopy,
  copiedField,
  onDocClick,
  onVerify,
}: DocRowProps) {
  const status = doc.status as DocStatus
  const config = DOC_STATUS_CONFIG[status] || DOC_STATUS_CONFIG.EXTRACTED
  const Icon = config.icon
  const docLabel = DOC_TYPE_LABELS[doc.docType] || doc.docType
  const updatedDate = new Date(doc.updatedAt).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const canVerify = status === 'EXTRACTED' || status === 'PARTIAL'

  // Extract preview fields from extracted data
  const previewFields = getPreviewFields(doc.docType, doc.extractedData)

  return (
    <div className="group">
      {/* Main Row */}
      <div
        className={cn(
          'grid grid-cols-12 gap-4 px-4 py-3 items-center cursor-pointer',
          'hover:bg-muted/30 transition-colors'
        )}
        onClick={() => onDocClick?.(doc)}
      >
        {/* Document Type */}
        <div className="col-span-12 md:col-span-4 flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', config.bgColor)}>
            <FileText className={cn('w-4 h-4', config.color)} />
          </div>
          <div>
            <p className="font-medium text-foreground text-sm">{docLabel}</p>
            {doc.rawImage && (
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                {doc.rawImage.filename}
              </p>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="col-span-6 md:col-span-3">
          <span className={cn(
            'inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full',
            config.bgColor,
            config.color
          )}>
            <Icon className="w-3 h-3" />
            {config.label}
          </span>
        </div>

        {/* Updated Date */}
        <div className="col-span-6 md:col-span-3 text-sm text-muted-foreground">
          {updatedDate}
        </div>

        {/* Actions */}
        <div className="hidden md:flex col-span-2 justify-end items-center gap-2">
          {canVerify && onVerify && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onVerify(doc)
              }}
              className="p-1.5 rounded-lg hover:bg-primary-light text-primary transition-colors"
              aria-label="Xác minh"
            >
              <Eye className="w-4 h-4" />
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

      {/* Expanded Content - Extracted Data Preview */}
      {isExpanded && previewFields.length > 0 && (
        <div className="px-4 pb-4 pt-0">
          <div className="ml-11 p-4 bg-muted/30 rounded-lg">
            <h4 className="text-sm font-medium text-foreground mb-3">Dữ liệu trích xuất</h4>
            <div className="space-y-2">
              {previewFields.map((field) => (
                <div
                  key={field.key}
                  className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
                >
                  <span className="text-sm text-muted-foreground">{field.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {field.value || '—'}
                    </span>
                    {field.value && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onCopy(field.value, `${doc.id}-${field.key}`)
                        }}
                        className="p-1 rounded hover:bg-muted transition-colors"
                        aria-label={`Copy ${field.label}`}
                      >
                        {copiedField === `${doc.id}-${field.key}` ? (
                          <Check className="w-3.5 h-3.5 text-success" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Field preview configuration by document type
interface PreviewField {
  key: string
  label: string
  value: string
}

function getPreviewFields(docType: string, data: Record<string, unknown>): PreviewField[] {
  if (!data || Object.keys(data).length === 0) return []

  // Define field mappings per document type
  const fieldMappings: Record<string, { key: string; label: string }[]> = {
    W2: [
      { key: 'employerName', label: 'Công ty' },
      { key: 'employerEin', label: 'EIN công ty' },
      { key: 'wagesTips', label: 'Lương (Box 1)' },
      { key: 'federalTaxWithheld', label: 'Thuế đã khấu (Box 2)' },
      { key: 'socialSecurityWages', label: 'SS Wages (Box 3)' },
      { key: 'medicareWages', label: 'Medicare Wages (Box 5)' },
    ],
    SSN_CARD: [
      { key: 'name', label: 'Họ tên' },
      { key: 'ssn', label: 'SSN' },
    ],
    DRIVER_LICENSE: [
      { key: 'name', label: 'Họ tên' },
      { key: 'licenseNumber', label: 'Số bằng lái' },
      { key: 'address', label: 'Địa chỉ' },
      { key: 'dateOfBirth', label: 'Ngày sinh' },
      { key: 'expirationDate', label: 'Ngày hết hạn' },
    ],
    FORM_1099_INT: [
      { key: 'payerName', label: 'Ngân hàng' },
      { key: 'interestIncome', label: 'Tiền lãi (Box 1)' },
    ],
    FORM_1099_NEC: [
      { key: 'payerName', label: 'Người trả' },
      { key: 'nonemployeeCompensation', label: 'Thu nhập (Box 1)' },
    ],
    FORM_1099_DIV: [
      { key: 'payerName', label: 'Công ty' },
      { key: 'ordinaryDividends', label: 'Cổ tức (Box 1a)' },
      { key: 'qualifiedDividends', label: 'Qualified (Box 1b)' },
    ],
    BANK_STATEMENT: [
      { key: 'bankName', label: 'Ngân hàng' },
      { key: 'accountNumber', label: 'Số tài khoản' },
      { key: 'routingNumber', label: 'Routing' },
    ],
  }

  const mapping = fieldMappings[docType] || Object.keys(data).slice(0, 5).map((k) => ({
    key: k,
    label: k.replace(/([A-Z])/g, ' $1').trim(),
  }))

  return mapping
    .filter((m) => data[m.key] !== undefined && data[m.key] !== null)
    .map((m) => ({
      key: m.key,
      label: m.label,
      value: formatFieldValue(data[m.key]),
    }))
}

/**
 * Sanitize string to prevent XSS - removes HTML tags and dangerous characters
 */
function sanitizeString(str: string): string {
  return str
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
}

function formatFieldValue(value: unknown): string {
  let result: string
  if (typeof value === 'number') {
    // Format as currency if it looks like money
    result = value >= 100 ? `$${value.toLocaleString()}` : String(value)
  } else {
    result = String(value)
  }
  // Sanitize to prevent XSS from OCR-extracted data
  return sanitizeString(result)
}

/**
 * Skeleton loader for Digital Doc Table
 */
export function DigitalDocTableSkeleton() {
  return (
    <div className="bg-card rounded-xl border overflow-hidden">
      {/* Header Skeleton */}
      <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-muted/50 border-b">
        <div className="col-span-4 h-4 bg-muted rounded animate-pulse" />
        <div className="col-span-3 h-4 bg-muted rounded animate-pulse" />
        <div className="col-span-3 h-4 bg-muted rounded animate-pulse" />
        <div className="col-span-2 h-4 bg-muted rounded animate-pulse" />
      </div>

      {/* Rows Skeleton */}
      <div className="divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="grid grid-cols-12 gap-4 px-4 py-3 items-center">
            <div className="col-span-12 md:col-span-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted animate-pulse" />
              <div className="space-y-1.5">
                <div className="w-24 h-4 bg-muted rounded animate-pulse" />
                <div className="w-32 h-3 bg-muted rounded animate-pulse" />
              </div>
            </div>
            <div className="col-span-6 md:col-span-3">
              <div className="w-20 h-5 bg-muted rounded-full animate-pulse" />
            </div>
            <div className="col-span-6 md:col-span-3">
              <div className="w-16 h-4 bg-muted rounded animate-pulse" />
            </div>
            <div className="hidden md:flex col-span-2 justify-end gap-2">
              <div className="w-7 h-7 bg-muted rounded-lg animate-pulse" />
              <div className="w-7 h-7 bg-muted rounded-lg animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
