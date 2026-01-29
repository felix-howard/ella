/**
 * DataEntryModal - Large modal for OltPro data entry workflow
 * Shows copyable fields in colorful grouped sections for easy copying
 * Features: clipboard copy with visual feedback, color-coded sections
 */

import { useState, useMemo, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, AlertTriangle, FileText } from 'lucide-react'
import { Badge } from '@ella/ui'
import { CopyableField } from '../ui/copyable-field'
import { DOC_TYPE_LABELS } from '../../lib/constants'
import { getFieldLabelForDocType, isExcludedField } from '../../lib/field-labels'
import { getDocTypeFields } from '../../lib/doc-type-fields'
import { DOC_TYPE_FIELD_GROUPS, type FieldGroup } from '../../lib/doc-type-field-groups'
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

  // Extract and group fields from extractedData based on doc type
  const { groupedFields, ungroupedFields } = useMemo(() => {
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

    // Get field groups for this doc type
    const docGroups = DOC_TYPE_FIELD_GROUPS[doc.docType] || []
    const groupedFieldKeys = new Set(docGroups.flatMap(g => g.fields))

    // Build grouped fields with values
    const grouped: Array<{ group: FieldGroup; fields: Array<[string, unknown]> }> = []
    for (const group of docGroups) {
      const groupFields: Array<[string, unknown]> = []
      for (const fieldKey of group.fields) {
        if (fieldKey in flattenedData) {
          groupFields.push([fieldKey, flattenedData[fieldKey]])
        }
      }
      if (groupFields.length > 0) {
        grouped.push({ group, fields: groupFields })
      }
    }

    // Collect ungrouped fields (fields not in any group)
    const ungrouped: Array<[string, unknown]> = []

    // First add expected fields in order
    for (const fieldKey of expectedFields) {
      if (fieldKey in flattenedData && !groupedFieldKeys.has(fieldKey)) {
        ungrouped.push([fieldKey, flattenedData[fieldKey]])
      }
    }
    // Then add any extra extracted fields
    for (const [key, value] of Object.entries(flattenedData)) {
      if (!expectedFieldsSet.has(key) && !groupedFieldKeys.has(key)) {
        ungrouped.push([key, value])
      }
    }

    return { groupedFields: grouped, ungroupedFields: ungrouped }
  }, [doc.extractedData, doc.docType])

  const hasAnyFields = groupedFields.length > 0 || ungroupedFields.length > 0

  // Handle field copy (in-session tracking only)
  const handleCopy = useCallback((fieldKey: string) => {
    setCopiedFields((prev) => ({ ...prev, [fieldKey]: true }))
  }, [])

  // Reset state when modal opens or doc changes
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentionally resetting state
      setCopiedFields({})
    }
  }, [isOpen, doc.id])

  if (!isOpen) return null

  const docLabel = DOC_TYPE_LABELS[doc.docType] || doc.docType

  // Use portal to render at document.body level to avoid stacking context issues
  return createPortal(
    <>
      {/* Backdrop - covers entire viewport */}
      <div
        className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal - large but not too wide */}
      <div
        className="fixed inset-y-2 inset-x-4 md:inset-y-3 md:inset-x-[10%] lg:inset-x-[15%] z-[100] flex flex-col bg-card rounded-xl border border-border shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-entry-modal-title"
      >
        {/* Header - Compact */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2
                id="data-entry-modal-title"
                className="text-lg font-bold text-foreground"
              >
                {docLabel}
              </h2>
              <p className="text-xs text-muted-foreground">
                Click vào giá trị để sao chép
              </p>
            </div>
            {doc.entryCompleted && (
              <Badge variant="success" className="text-xs ml-2">
                Đã hoàn tất
              </Badge>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted/80 transition-colors"
            aria-label="Đóng"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content - Compact spacing */}
        <div className="flex-1 overflow-y-auto p-4">
          {!hasAnyFields ? (
            <div className="text-center py-16 text-muted-foreground">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <p className="text-lg font-medium">Không có dữ liệu được trích xuất</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Grouped fields - consistent primary accent */}
              {groupedFields.map(({ group, fields }) => {
                const Icon = group.icon
                return (
                  <section
                    key={group.key}
                    className="rounded-lg border border-border overflow-hidden"
                  >
                    {/* Section header - compact */}
                    <div className="flex items-center gap-2 px-4 py-2 border-l-4 border-l-primary bg-muted/30">
                      <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {group.label}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        ({fields.length})
                      </span>
                    </div>

                    {/* Section fields - tight grid */}
                    <div className="px-2 py-1 grid grid-cols-1 lg:grid-cols-2 gap-0">
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
                  </section>
                )
              })}

              {/* Ungrouped fields - if any */}
              {ungroupedFields.length > 0 && (
                <section className="rounded-lg border border-border overflow-hidden">
                  {/* Section header - compact */}
                  <div className="flex items-center gap-2 px-4 py-2 border-l-4 border-l-primary bg-muted/30">
                    <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Thông tin khác
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      ({ungroupedFields.length})
                    </span>
                  </div>

                  {/* Section fields - tight grid */}
                  <div className="px-2 py-1 grid grid-cols-1 lg:grid-cols-2 gap-0">
                    {ungroupedFields.map(([key, value]) => (
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
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  )
}
