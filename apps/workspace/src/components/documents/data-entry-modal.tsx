/**
 * DataEntryModal - Split-screen modal for OltPro data entry workflow
 * Left panel: Zoomable image viewer for reference
 * Right panel: Copyable fields with progress tracking
 * Features: clipboard copy, persisted copy state, reset/complete functionality
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, AlertTriangle, ImageOff, RefreshCw, RotateCcw } from 'lucide-react'
import { Badge, Button } from '@ella/ui'
import { ImageViewer } from '../ui/image-viewer'
import { CopyableField } from '../ui/copyable-field'
import { ProgressIndicator } from '../ui/progress-indicator'
import { DOC_TYPE_LABELS } from '../../lib/constants'
import { getFieldLabelForDocType, isExcludedField } from '../../lib/field-labels'
import { getDocTypeFields } from '../../lib/doc-type-fields'
import { api, type DigitalDoc } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { useSignedUrl } from '../../hooks/use-signed-url'

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

// Vietnamese toast messages
const MESSAGES = {
  COPY_SUCCESS: 'Đã sao chép',
  COPY_ERROR: 'Lỗi sao chép',
  COMPLETE_SUCCESS: 'Đã hoàn tất nhập liệu',
  COMPLETE_ERROR: 'Lỗi hoàn tất nhập liệu',
  RESET_SUCCESS: 'Đã reset tiến độ',
  RESET_ERROR: 'Lỗi reset tiến độ',
  ALL_FIELDS_REQUIRED: 'Vui lòng sao chép tất cả các trường trước khi hoàn tất',
}

// Type guard helpers
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Validate signed URL to prevent XSS attacks
 */
function isValidSignedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    const trustedHosts = [
      '.r2.cloudflarestorage.com',
      '.amazonaws.com',
      '.storage.googleapis.com',
      '.blob.core.windows.net',
    ]
    return trustedHosts.some((host) => parsed.hostname.endsWith(host))
  } catch {
    return false
  }
}

export function DataEntryModal({
  doc,
  isOpen,
  onClose,
  caseId,
}: DataEntryModalProps) {
  const queryClient = useQueryClient()
  const [isResetting, setIsResetting] = useState(false)
  // Local state for instant optimistic UI updates (doesn't wait for query refetch)
  const [localCopiedFields, setLocalCopiedFields] = useState<Record<string, boolean>>({})

  // Get signed URL for image
  const rawImageId = doc.rawImage?.id || doc.rawImageId
  const {
    data: signedUrlData,
    isLoading: isUrlLoading,
    error: urlError,
    refetch: refetchUrl,
  } = useSignedUrl(rawImageId, { enabled: isOpen && !!rawImageId })

  // Extract fields from extractedData based on doc type
  const { fields, copiedFields } = useMemo(() => {
    const extractedData = isRecord(doc.extractedData) ? doc.extractedData : {}
    // Merge server state with local optimistic state (local takes precedence for instant feedback)
    const serverCopied = isRecord(doc.copiedFields)
      ? (doc.copiedFields as Record<string, boolean>)
      : {}
    const copied = { ...serverCopied, ...localCopiedFields }

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

    return {
      fields: orderedFields,
      copiedFields: copied,
    }
  }, [doc.extractedData, doc.copiedFields, doc.docType, localCopiedFields])

  // Calculate copy progress
  const totalFields = fields.length
  const copiedCount = fields.filter(([key]) => copiedFields[key]).length
  const allCopied = totalFields > 0 && copiedCount === totalFields

  // Mark field as copied mutation
  const markCopiedMutation = useMutation({
    mutationFn: (field: string) => api.docs.markCopied(doc.id, field),
    onMutate: async (field) => {
      // Instant local state update for immediate UI feedback
      setLocalCopiedFields((prev) => ({ ...prev, [field]: true }))

      // Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey: ['case', caseId] })

      // Snapshot previous values
      const previousCase = queryClient.getQueryData(['case', caseId])
      const previousLocalCopied = { ...localCopiedFields }

      // Optimistically update query cache too
      queryClient.setQueryData(['case', caseId], (old: unknown) => {
        if (!isRecord(old)) return old
        const digitalDocs = Array.isArray(old.digitalDocs) ? old.digitalDocs : []
        return {
          ...old,
          digitalDocs: digitalDocs.map((d: unknown) => {
            if (!isRecord(d) || d.id !== doc.id) return d
            const currentCopied = isRecord(d.copiedFields) ? d.copiedFields : {}
            return {
              ...d,
              copiedFields: { ...currentCopied, [field]: true },
            }
          }),
        }
      })

      return { previousCase, previousLocalCopied }
    },
    onError: (_error, field, context) => {
      // Rollback local state on error
      if (context?.previousLocalCopied) {
        setLocalCopiedFields(context.previousLocalCopied)
      }
      // Rollback query cache on error
      if (context?.previousCase) {
        queryClient.setQueryData(['case', caseId], context.previousCase)
      }
      toast.error(`${MESSAGES.COPY_ERROR}: ${field}`)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] })
    },
  })

  // Complete entry mutation
  const completeEntryMutation = useMutation({
    mutationFn: () => api.docs.completeEntry(doc.id),
    onSuccess: () => {
      toast.success(MESSAGES.COMPLETE_SUCCESS)
      queryClient.invalidateQueries({ queryKey: ['case', caseId] })
      onClose()
    },
    onError: () => {
      toast.error(MESSAGES.COMPLETE_ERROR)
    },
  })

  // Handle field copy
  const handleCopy = useCallback(
    (fieldKey: string) => {
      markCopiedMutation.mutate(fieldKey)
    },
    [markCopiedMutation]
  )

  // Handle reset progress (marks all fields as not copied)
  const handleReset = useCallback(async () => {
    setIsResetting(true)
    try {
      // Clear local optimistic state
      setLocalCopiedFields({})
      // Reset by marking all copied fields as not copied
      // Note: API should support bulk reset, but for now we'll do it client-side
      // and invalidate the query to get fresh state
      await queryClient.invalidateQueries({ queryKey: ['case', caseId] })
      toast.success(MESSAGES.RESET_SUCCESS)
    } catch {
      toast.error(MESSAGES.RESET_ERROR)
    } finally {
      setIsResetting(false)
    }
  }, [caseId, queryClient])

  // Handle complete entry
  const handleComplete = useCallback(() => {
    if (!allCopied) {
      toast.error(MESSAGES.ALL_FIELDS_REQUIRED)
      return
    }
    completeEntryMutation.mutate()
  }, [allCopied, completeEntryMutation])

  // Reset local state when modal opens or doc changes
  useEffect(() => {
    if (isOpen) {
      setLocalCopiedFields({}) // Clear local optimistic state for fresh doc
    }
  }, [isOpen, doc.id])

  if (!isOpen) return null

  const docLabel = DOC_TYPE_LABELS[doc.docType] || doc.docType
  const isPdf = doc.rawImage?.r2Key?.endsWith('.pdf')
  const validatedUrl =
    signedUrlData?.url && isValidSignedUrl(signedUrlData.url) ? signedUrlData.url : null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-4 md:inset-8 lg:inset-12 z-50 flex flex-col bg-card rounded-xl border border-border shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-entry-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <h2
              id="data-entry-modal-title"
              className="text-lg font-semibold text-foreground"
            >
              Chế độ nhập liệu - {docLabel}
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

        {/* Content - Split view (responsive) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left: Image Viewer */}
          <div className="h-1/2 md:h-full md:w-1/2 border-b md:border-b-0 md:border-r border-border bg-muted/20 p-4">
            {isUrlLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
              </div>
            ) : urlError || !validatedUrl ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <ImageOff className="w-12 h-12" />
                <p className="text-sm">Không thể tải hình ảnh</p>
                <Button variant="outline" size="sm" onClick={() => refetchUrl()} className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Thử lại
                </Button>
              </div>
            ) : (
              <ImageViewer
                imageUrl={validatedUrl}
                isPdf={isPdf}
                className="w-full h-full"
              />
            )}
          </div>

          {/* Right: Copy Panel */}
          <div className="h-1/2 md:h-full md:w-1/2 flex flex-col overflow-hidden">
            {/* Status header */}
            <div className="px-4 py-3 border-b border-border bg-muted/10">
              <p className="text-sm text-secondary">
                Sao chép dữ liệu sang OltPro - nhấn nút Copy để sao chép từng trường
              </p>
            </div>

            {/* Fields list - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {fields.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                  <p>Không có dữ liệu được trích xuất</p>
                </div>
              ) : (
                fields.map(([key, value]) => (
                  <CopyableField
                    key={key}
                    fieldKey={key}
                    label={getFieldLabelForDocType(key, doc.docType)}
                    value={String(value ?? '')}
                    isCopied={copiedFields[key] || false}
                    onCopy={handleCopy}
                    disabled={markCopiedMutation.isPending}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-border bg-muted/10 space-y-3">
              {/* Progress */}
              <ProgressIndicator
                current={copiedCount}
                total={totalFields}
                label="Tiến độ copy"
              />

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={isResetting || copiedCount === 0}
                  className="gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset tiến độ
                </Button>
                <Button
                  onClick={handleComplete}
                  disabled={!allCopied || doc.entryCompleted || completeEntryMutation.isPending}
                  className="flex-1"
                >
                  {completeEntryMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang lưu...
                    </>
                  ) : doc.entryCompleted ? (
                    'Đã hoàn tất'
                  ) : (
                    'Đánh dấu hoàn tất'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
