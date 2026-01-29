/**
 * OCR Verification Panel - Side panel for verifying/editing extracted OCR data
 * Shows extracted fields grouped by category with inline editing
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import { cn } from '@ella/ui'
import {
  X,
  Check,
  Edit2,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Copy,
  Image as ImageIcon,
  ZoomIn,
} from 'lucide-react'
import { DOC_TYPE_LABELS } from '../../lib/constants'
import { getFieldLabelForDocType, isExcludedField } from '../../lib/field-labels'
import { copyToClipboard } from '../../lib/formatters'
import { DOC_TYPE_FIELD_GROUPS } from '../../lib/doc-type-field-groups'
import { FieldEditForm } from './field-edit-form'
import type { DigitalDoc, RawImage } from '../../lib/api-client'

type DocStatus = 'EXTRACTED' | 'VERIFIED' | 'PARTIAL' | 'FAILED'

const STATUS_CONFIG: Record<DocStatus, { label: string; icon: typeof CheckCircle; color: string }> = {
  EXTRACTED: { label: 'Cần xác minh', icon: Clock, color: 'text-primary' },
  VERIFIED: { label: 'Đã xác minh', icon: CheckCircle, color: 'text-success' },
  PARTIAL: { label: 'Thiếu dữ liệu', icon: AlertCircle, color: 'text-warning' },
  FAILED: { label: 'Lỗi OCR', icon: AlertCircle, color: 'text-error' },
}

export interface OCRVerificationPanelProps {
  isOpen: boolean
  onClose: () => void
  doc: DigitalDoc | null
  rawImage?: RawImage | null
  onSave: (docId: string, updatedData: Record<string, unknown>) => Promise<void>
  onVerify: (docId: string) => Promise<void>
  onViewImage?: () => void
}

export function OCRVerificationPanel({
  isOpen,
  onClose,
  doc,
  rawImage,
  onSave,
  onVerify,
  onViewImage,
}: OCRVerificationPanelProps) {
  const [editingField, setEditingField] = useState<string | null>(null)
  const [localData, setLocalData] = useState<Record<string, unknown>>({})
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Initialize local data when doc changes
  useEffect(() => {
    if (doc) {
      setLocalData({ ...doc.extractedData })
      setEditingField(null)
    }
  }, [doc])

  // Compute grouped fields from shared config
  const { groupedSections, ungroupedFields } = useMemo(() => {
    if (!doc) return { groupedSections: [], ungroupedFields: [] }

    const data = localData || {}
    const docGroups = DOC_TYPE_FIELD_GROUPS[doc.docType] || []
    const groupedKeys = new Set(docGroups.flatMap((g) => g.fields))

    // Build grouped sections with data values (skip null/undefined/empty)
    const sections = docGroups
      .map((group) => {
        const fields = group.fields
          .filter((key) => {
            const val = data[key]
            return val !== undefined && val !== null && val !== ''
          })
          .map((key) => ({ key, value: data[key] }))
        return { group, fields }
      })
      .filter((s) => s.fields.length > 0)

    // Collect ungrouped fields (in extractedData but not in any group)
    const ungrouped = Object.entries(data)
      .filter(([key]) => !groupedKeys.has(key) && !isExcludedField(key) && typeof data[key] !== 'object')
      .map(([key, value]) => ({ key, value }))

    return { groupedSections: sections, ungroupedFields: ungrouped }
  }, [doc, localData])

  const handleCopy = useCallback(async (value: unknown, fieldKey: string) => {
    const success = await copyToClipboard(String(value))
    if (success) {
      setCopiedField(fieldKey)
      setTimeout(() => setCopiedField(null), 2000)
    }
  }, [])

  const handleFieldSave = useCallback((key: string, value: unknown) => {
    setLocalData((prev) => ({ ...prev, [key]: value }))
    setEditingField(null)
  }, [])

  const handleSaveAll = useCallback(async () => {
    if (!doc) return
    setIsSubmitting(true)
    try {
      await onSave(doc.id, localData)
    } catch (error) {
      console.error('Save failed:', error)
    } finally {
      setIsSubmitting(false)
    }
  }, [doc, localData, onSave])

  const handleVerifyDoc = useCallback(async () => {
    if (!doc) return
    setIsSubmitting(true)
    try {
      await onVerify(doc.id)
      onClose()
    } catch (error) {
      console.error('Verify failed:', error)
    } finally {
      setIsSubmitting(false)
    }
  }, [doc, onVerify, onClose])

  if (!isOpen || !doc) return null

  const status = doc.status as DocStatus
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.EXTRACTED
  const StatusIcon = statusConfig.icon
  const docLabel = DOC_TYPE_LABELS[doc.docType] || doc.docType
  const hasChanges = JSON.stringify(localData) !== JSON.stringify(doc.extractedData)

  // Infer field type from value for FieldEditForm
  const inferFieldType = (value: unknown): 'text' | 'number' | 'date' => {
    if (typeof value === 'number') return 'number'
    return 'text'
  }

  // Render a single field row (reused for grouped and ungrouped)
  const renderFieldRow = (key: string, value: unknown) => {
    const isEditing = editingField === key
    const isCopied = copiedField === key
    const label = getFieldLabelForDocType(key, doc.docType)
    const fieldType = inferFieldType(value)

    if (isEditing) {
      return (
        <div key={key} className="p-3">
          <FieldEditForm
            fieldKey={key}
            label={label}
            value={value}
            type={fieldType}
            onSave={(newValue) => handleFieldSave(key, newValue)}
            onCancel={() => setEditingField(null)}
          />
        </div>
      )
    }

    return (
      <div key={key} className="group flex items-center justify-between p-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-semibold text-foreground truncate">
            {value !== undefined && value !== null && value !== ''
              ? formatDisplayValue(value, fieldType)
              : <span className="text-muted-foreground italic">—</span>}
          </p>
        </div>
        {/* Always-visible action buttons for touch support */}
        <div className="flex items-center gap-1">
          {value !== undefined && value !== null && value !== '' && (
            <button
              onClick={() => handleCopy(value, key)}
              className="p-1.5 rounded hover:bg-muted transition-colors"
              aria-label={`Copy ${label}`}
            >
              {isCopied ? (
                <Check className="w-4 h-4 text-success" />
              ) : (
                <Copy className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          )}
          <button
            onClick={() => setEditingField(key)}
            className="p-1.5 rounded hover:bg-muted transition-colors"
            aria-label={`Sửa ${label}`}
          >
            <Edit2 className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'fixed inset-y-0 right-0 z-40 w-full sm:w-96 md:w-[480px]',
        'bg-card border-l border-border shadow-xl',
        'transform transition-transform duration-300',
        isOpen ? 'translate-x-0' : 'translate-x-full'
      )}
      role="dialog"
      aria-modal="true"
      aria-label={`Xác minh OCR: ${docLabel}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg bg-primary-light')}>
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">{docLabel}</h2>
            <div className="flex items-center gap-1.5 text-sm">
              <StatusIcon className={cn('w-3.5 h-3.5', statusConfig.color)} />
              <span className={statusConfig.color}>{statusConfig.label}</span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          aria-label="Đóng"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Image Preview Link */}
      {rawImage && onViewImage && (
        <button
          onClick={onViewImage}
          className="w-full flex items-center gap-3 p-4 border-b border-border hover:bg-muted/50 transition-colors"
        >
          <div className="w-16 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
            <ImageIcon className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-foreground truncate">{rawImage.filename}</p>
            <p className="text-xs text-muted-foreground">Nhấn để xem ảnh gốc</p>
          </div>
          <ZoomIn className="w-4 h-4 text-muted-foreground" />
        </button>
      )}

      {/* Fields List - Grouped */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {groupedSections.map(({ group, fields }) => {
          const Icon = group.icon
          return (
            <section key={group.key} className="rounded-lg border border-border overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-l-4 border-l-primary bg-muted/30">
                <div className="p-1 rounded-md bg-primary/10 text-primary">
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
                <span className="text-xs text-muted-foreground">({fields.length})</span>
              </div>
              <div className="divide-y divide-border/50">
                {fields.map(({ key, value }) => renderFieldRow(key, value))}
              </div>
            </section>
          )
        })}

        {/* Ungrouped fields */}
        {ungroupedFields.length > 0 && (
          <section className="rounded-lg border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-l-4 border-l-primary bg-muted/30">
              <div className="p-1 rounded-md bg-primary/10 text-primary">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Thông tin khác</h3>
              <span className="text-xs text-muted-foreground">({ungroupedFields.length})</span>
            </div>
            <div className="divide-y divide-border/50">
              {ungroupedFields.map(({ key, value }) => renderFieldRow(key, value))}
            </div>
          </section>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-border space-y-3">
        {hasChanges && (
          <button
            onClick={handleSaveAll}
            disabled={isSubmitting}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg',
              'bg-muted text-foreground font-medium',
              'hover:bg-muted/80 transition-colors',
              isSubmitting && 'opacity-50 cursor-not-allowed'
            )}
          >
            <span>Lưu thay đổi</span>
          </button>
        )}

        {status !== 'VERIFIED' && (
          <button
            onClick={handleVerifyDoc}
            disabled={isSubmitting}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-full',
              'bg-primary text-white font-medium',
              'hover:bg-primary-dark transition-colors',
              isSubmitting && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Check className="w-5 h-5" />
            <span>Xác minh & Hoàn tất</span>
          </button>
        )}

        {status === 'VERIFIED' && (
          <div className="flex items-center justify-center gap-2 p-3 bg-success/10 rounded-lg text-success">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Đã xác minh</span>
          </div>
        )}
      </div>
    </div>
  )
}

/** Format value for display based on field type */
function formatDisplayValue(value: unknown, type: 'text' | 'number' | 'date'): string {
  if (value === null || value === undefined) return ''

  if (type === 'number' && typeof value === 'number') {
    return value >= 100 ? `$${value.toLocaleString()}` : String(value)
  }

  if (type === 'date' && typeof value === 'string') {
    try {
      const date = new Date(value)
      return date.toLocaleDateString('vi-VN')
    } catch {
      return value
    }
  }

  return String(value)
}
