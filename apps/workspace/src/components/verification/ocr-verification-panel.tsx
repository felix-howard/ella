/**
 * OCR Verification Panel - Side panel for verifying/editing extracted OCR data
 * Shows extracted fields with inline editing capability
 */

import { useState, useCallback } from 'react'
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
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  ZoomIn,
} from 'lucide-react'
import { DOC_TYPE_LABELS } from '../../lib/constants'
import { copyToClipboard } from '../../lib/formatters'
import { FieldEditForm } from './field-edit-form'
import type { DigitalDoc, RawImage } from '../../lib/api-client'

// Field configuration for different document types
const FIELD_CONFIGS: Record<string, { key: string; label: string; type: 'text' | 'number' | 'date' }[]> = {
  W2: [
    { key: 'employerName', label: 'Tên công ty', type: 'text' },
    { key: 'employerEin', label: 'EIN công ty', type: 'text' },
    { key: 'employeeSSN', label: 'SSN nhân viên', type: 'text' },
    { key: 'employeeName', label: 'Tên nhân viên', type: 'text' },
    { key: 'wagesTips', label: 'Lương (Box 1)', type: 'number' },
    { key: 'federalTaxWithheld', label: 'Thuế đã khấu (Box 2)', type: 'number' },
    { key: 'socialSecurityWages', label: 'SS Wages (Box 3)', type: 'number' },
    { key: 'socialSecurityTax', label: 'SS Tax (Box 4)', type: 'number' },
    { key: 'medicareWages', label: 'Medicare Wages (Box 5)', type: 'number' },
    { key: 'medicareTax', label: 'Medicare Tax (Box 6)', type: 'number' },
  ],
  SSN_CARD: [
    { key: 'name', label: 'Họ tên', type: 'text' },
    { key: 'ssn', label: 'SSN', type: 'text' },
  ],
  DRIVER_LICENSE: [
    { key: 'name', label: 'Họ tên', type: 'text' },
    { key: 'licenseNumber', label: 'Số bằng lái', type: 'text' },
    { key: 'address', label: 'Địa chỉ', type: 'text' },
    { key: 'dateOfBirth', label: 'Ngày sinh', type: 'date' },
    { key: 'expirationDate', label: 'Ngày hết hạn', type: 'date' },
    { key: 'state', label: 'Tiểu bang', type: 'text' },
  ],
  FORM_1099_INT: [
    { key: 'payerName', label: 'Tên ngân hàng', type: 'text' },
    { key: 'payerTin', label: 'TIN ngân hàng', type: 'text' },
    { key: 'recipientName', label: 'Tên người nhận', type: 'text' },
    { key: 'recipientTin', label: 'TIN người nhận', type: 'text' },
    { key: 'interestIncome', label: 'Tiền lãi (Box 1)', type: 'number' },
    { key: 'earlyWithdrawalPenalty', label: 'Phạt rút sớm (Box 2)', type: 'number' },
    { key: 'federalTaxWithheld', label: 'Thuế đã khấu (Box 4)', type: 'number' },
  ],
  FORM_1099_NEC: [
    { key: 'payerName', label: 'Tên người trả', type: 'text' },
    { key: 'payerTin', label: 'TIN người trả', type: 'text' },
    { key: 'recipientName', label: 'Tên người nhận', type: 'text' },
    { key: 'recipientTin', label: 'TIN người nhận', type: 'text' },
    { key: 'nonemployeeCompensation', label: 'Thu nhập (Box 1)', type: 'number' },
    { key: 'federalTaxWithheld', label: 'Thuế đã khấu (Box 4)', type: 'number' },
  ],
  FORM_1099_DIV: [
    { key: 'payerName', label: 'Tên công ty', type: 'text' },
    { key: 'payerTin', label: 'TIN công ty', type: 'text' },
    { key: 'ordinaryDividends', label: 'Cổ tức (Box 1a)', type: 'number' },
    { key: 'qualifiedDividends', label: 'Qualified (Box 1b)', type: 'number' },
    { key: 'capitalGainDistributions', label: 'Capital Gains (Box 2a)', type: 'number' },
    { key: 'federalTaxWithheld', label: 'Thuế đã khấu (Box 4)', type: 'number' },
  ],
  BANK_STATEMENT: [
    { key: 'bankName', label: 'Tên ngân hàng', type: 'text' },
    { key: 'accountNumber', label: 'Số tài khoản', type: 'text' },
    { key: 'routingNumber', label: 'Routing Number', type: 'text' },
    { key: 'accountHolderName', label: 'Tên chủ tài khoản', type: 'text' },
  ],
}

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
  const [showAllFields, setShowAllFields] = useState(false)

  // Initialize local data when doc changes
  useState(() => {
    if (doc) {
      setLocalData({ ...doc.extractedData })
      setEditingField(null)
    }
  })

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
  const fieldConfig = FIELD_CONFIGS[doc.docType] || []

  // Get all fields: configured + extra from extractedData
  const configuredKeys = new Set(fieldConfig.map((f) => f.key))
  const extraFields = Object.keys(doc.extractedData || {})
    .filter((key) => !configuredKeys.has(key))
    .map((key) => ({ key, label: key, type: 'text' as const }))

  const allFields = [...fieldConfig, ...extraFields]
  const displayFields = showAllFields ? allFields : allFields.slice(0, 8)
  const hasMoreFields = allFields.length > 8

  // Check if there are unsaved changes
  const hasChanges = JSON.stringify(localData) !== JSON.stringify(doc.extractedData)

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

      {/* Fields List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {displayFields.map((field) => {
            const value = localData[field.key]
            const isEditing = editingField === field.key
            const isCopied = copiedField === field.key

            return (
              <div
                key={field.key}
                className={cn(
                  'group rounded-lg border border-transparent',
                  'hover:border-border hover:bg-muted/30 transition-colors'
                )}
              >
                {isEditing ? (
                  <div className="p-3">
                    <FieldEditForm
                      fieldKey={field.key}
                      label={field.label}
                      value={value}
                      type={field.type}
                      onSave={(newValue) => handleFieldSave(field.key, newValue)}
                      onCancel={() => setEditingField(null)}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{field.label}</p>
                      <p className="text-sm font-medium text-foreground truncate">
                        {value !== undefined && value !== null && value !== ''
                          ? formatDisplayValue(value, field.type)
                          : <span className="text-muted-foreground italic">—</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {value !== undefined && value !== null && value !== '' && (
                        <button
                          onClick={() => handleCopy(value, field.key)}
                          className="p-1.5 rounded hover:bg-muted transition-colors"
                          aria-label={`Copy ${field.label}`}
                        >
                          {isCopied ? (
                            <Check className="w-4 h-4 text-success" />
                          ) : (
                            <Copy className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => setEditingField(field.key)}
                        className="p-1.5 rounded hover:bg-muted transition-colors"
                        aria-label={`Sửa ${field.label}`}
                      >
                        <Edit2 className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Show More/Less Button */}
        {hasMoreFields && (
          <button
            onClick={() => setShowAllFields(!showAllFields)}
            className="w-full flex items-center justify-center gap-2 mt-4 py-2 text-sm text-primary hover:text-primary-dark"
          >
            {showAllFields ? (
              <>
                <ChevronUp className="w-4 h-4" />
                <span>Thu gọn</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                <span>Xem thêm {allFields.length - 8} trường</span>
              </>
            )}
          </button>
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

/**
 * Format value for display based on field type
 */
function formatDisplayValue(value: unknown, type: 'text' | 'number' | 'date'): string {
  if (value === null || value === undefined) return ''

  if (type === 'number' && typeof value === 'number') {
    // Format as currency if large number
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
