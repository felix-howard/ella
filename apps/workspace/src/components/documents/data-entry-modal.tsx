/**
 * DataEntryModal - Large modal for OltPro data entry workflow
 * Shows copyable fields in 2-column grid for easy copying
 * Features: clipboard copy with visual feedback
 */

import { useState, useMemo, useEffect, useCallback } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { Badge } from '@ella/ui'
import { CopyableField } from '../ui/copyable-field'
import { DOC_TYPE_LABELS } from '../../lib/constants'
import { getFieldLabelForDocType, isExcludedField } from '../../lib/field-labels'
import { getDocTypeFields } from '../../lib/doc-type-fields'
import type { DigitalDoc } from '../../lib/api-client'

export interface DataEntryModalProps {
  /** Document for data entry */
  doc: DigitalDoc
  /** Whether modal is open */
  isOpen: boolean
  /** Callback when modal closes */
  onClose: () => void
  /** Case ID for query invalidation */
  caseId: string
}

// Type guard helper
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function DataEntryModal({
  doc,
  isOpen,
  onClose,
}: DataEntryModalProps) {
  // Local in-session state for tracking which fields have been copied (not persisted)
  const [copiedFields, setCopiedFields] = useState<Record<string, boolean>>({})

  // Extract fields from extractedData based on doc type
  const fields = useMemo(() => {
    const extractedData = isRecord(doc.extractedData) ? doc.extractedData : {}

    // Get expected fields for this document type
    const expectedFields = getDocTypeFields(doc.docType)
    const expectedFieldsSet = new Set(expectedFields)

    // Flatten nested objects (e.g., stateTaxInfo array for 1099-NEC)
    const flattenedData: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(extractedData)) {
      // Handle stateTaxInfo array - flatten first entry only
      if (key === 'stateTaxInfo' && Array.isArray(value) && value.length > 0) {
        const firstState = value[0]
        if (isRecord(firstState)) {
          if (firstState.state) flattenedData.state = firstState.state
          if (firstState.statePayerStateNo) flattenedData.statePayerStateNo = firstState.statePayerStateNo
          if (firstState.stateIncome != null) flattenedData.stateIncome = firstState.stateIncome
        }
      } else if (!isExcludedField(key) && typeof value !== 'object') {
        flattenedData[key] = value
      }
    }

    // Order by expected fields order for consistent display
    const orderedFields: Array<[string, unknown]> = []
    for (const fieldKey of expectedFields) {
      if (fieldKey in flattenedData) {
        orderedFields.push([fieldKey, flattenedData[fieldKey]])
      }
    }
    // Add any extra extracted fields not in expected list
    for (const [key, value] of Object.entries(flattenedData)) {
      if (!expectedFieldsSet.has(key)) {
        orderedFields.push([key, value])
      }
    }

    return orderedFields
  }, [doc.extractedData, doc.docType])

  // Handle field copy (in-session tracking only)
  const handleCopy = useCallback((fieldKey: string) => {
    setCopiedFields((prev) => ({ ...prev, [fieldKey]: true }))
  }, [])

  // Reset state when modal opens or doc changes
  useEffect(() => {
    if (isOpen) {
      setCopiedFields({})
    }
  }, [isOpen, doc.id])

  if (!isOpen) return null

  const docLabel = DOC_TYPE_LABELS[doc.docType] || doc.docType

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal - large, centered */}
      <div
        className="fixed inset-4 md:inset-8 lg:inset-12 z-50 flex flex-col bg-card rounded-xl border border-border shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-entry-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <h2
              id="data-entry-modal-title"
              className="text-lg font-semibold text-foreground"
            >
              {docLabel}
            </h2>
            {doc.entryCompleted && (
              <Badge variant="success" className="text-xs">
                Đã hoàn tất
              </Badge>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Đóng"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content - 2 column grid for many fields */}
        <div className="flex-1 overflow-y-auto p-6">
          {fields.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
              <p>Không có dữ liệu được trích xuất</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-1">
              {fields.map(([key, value]) => (
                <CopyableField
                  key={key}
                  fieldKey={key}
                  label={getFieldLabelForDocType(key, doc.docType)}
                  value={String(value ?? '')}
                  isCopied={copiedFields[key] || false}
                  onCopy={handleCopy}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
