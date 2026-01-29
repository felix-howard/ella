/**
 * VerificationModal - Split-screen modal for document field verification
 * Left panel: Zoomable image viewer
 * Right panel: Field verification controls with progress tracking
 * Features: auto-save on blur, optimistic updates, keyboard shortcuts
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, AlertTriangle, ImageOff, RefreshCw, Sparkles, FileCheck, FileText, CheckCircle2, Clock } from 'lucide-react'
import { cn, Badge, Button } from '@ella/ui'
import { ImageViewer } from '../ui/image-viewer'
import { FieldVerificationItem } from '../ui/field-verification-item'
import { DOC_TYPE_LABELS } from '../../lib/constants'
import { getFieldLabelForDocType, isExcludedField } from '../../lib/field-labels'
import { getDocTypeFields } from '../../lib/doc-type-fields'
import { DOC_TYPE_FIELD_GROUPS } from '../../lib/doc-type-field-groups'
import { api, type DigitalDoc, type FieldVerificationStatus } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { useSignedUrl } from '../../hooks/use-signed-url'

export interface VerificationModalProps {
  /** Document to verify */
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
  VERIFY_SUCCESS: 'Đã xác minh trường',
  VERIFY_ERROR: 'Lỗi xác minh trường',
  COMPLETE_SUCCESS: 'Đã hoàn tất xác minh tài liệu',
  COMPLETE_ERROR: 'Lỗi hoàn tất xác minh',
  ALL_FIELDS_REQUIRED: 'Vui lòng xác minh tất cả các trường',
  EXTRACT_SUCCESS: 'Đã trích xuất dữ liệu thành công',
  EXTRACT_ERROR: 'Lỗi trích xuất dữ liệu',
  EXTRACT_AI_NOT_CONFIGURED: 'AI chưa được cấu hình. Vui lòng nhập liệu thủ công.',
  EXTRACT_RATE_LIMIT: 'Đã vượt giới hạn API. Vui lòng thử lại sau ít phút.',
  EXTRACT_UNSUPPORTED: 'Loại tài liệu này không hỗ trợ trích xuất OCR.',
}

/**
 * Parse OCR error message to user-friendly Vietnamese message
 */
function parseOcrError(message: string): string {
  if (message.includes('429') || message.includes('quota') || message.includes('rate')) {
    return MESSAGES.EXTRACT_RATE_LIMIT
  }
  if (message.includes('UNSUPPORTED_DOC_TYPE') || message.includes('does not support OCR')) {
    return MESSAGES.EXTRACT_UNSUPPORTED
  }
  if (message.includes('AI not configured')) {
    return MESSAGES.EXTRACT_AI_NOT_CONFIGURED
  }
  // Default short error
  return MESSAGES.EXTRACT_ERROR
}

// Type guard helpers
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value)
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

export function VerificationModal({
  doc,
  isOpen,
  onClose,
  caseId,
}: VerificationModalProps) {
  const queryClient = useQueryClient()
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0)
  // Local state for instant optimistic UI updates (doesn't wait for query refetch)
  const [localVerifications, setLocalVerifications] = useState<Record<string, FieldVerificationStatus>>({})
  // Local state for edited field values (prevents revert on query refetch)
  const [localEditedValues, setLocalEditedValues] = useState<Record<string, string>>({})

  // Get signed URL for image
  const rawImageId = doc.rawImage?.id || doc.rawImageId
  const {
    data: signedUrlData,
    isLoading: isUrlLoading,
    error: urlError,
    refetch: refetchUrl,
  } = useSignedUrl(rawImageId, { enabled: isOpen && !!rawImageId })

  // Memoize extracted data parsing separately for granular updates
  const extractedData = useMemo(
    () => (isRecord(doc.extractedData) ? doc.extractedData : {}),
    [doc.extractedData]
  )

  // Extract, filter and group fields based on doc-type-specific fields
  const { fields, fieldVerifications, groupedSections, ungroupedFields, fieldIndexMap } = useMemo(() => {
    // Merge server state with local optimistic state (local takes precedence for instant feedback)
    const serverVerifications = isRecord(doc.fieldVerifications)
      ? (doc.fieldVerifications as Record<string, FieldVerificationStatus>)
      : {}
    const verifications = { ...serverVerifications, ...localVerifications }

    // Get expected fields for this document type
    const expectedFields = getDocTypeFields(doc.docType)
    const expectedFieldsSet = new Set(expectedFields)

    // Flatten nested objects (e.g., stateTaxInfo array for 1099-NEC)
    // Note: Multi-state forms only show first state entry. Most 1099-NEC have 1 state.
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
        // Regular non-object fields
        flattenedData[key] = value
      }
    }

    // Apply local edited values (takes precedence over server data)
    for (const [key, value] of Object.entries(localEditedValues)) {
      flattenedData[key] = value
    }

    // Build flat ordered fields (for keyboard navigation)
    const orderedFields: Array<[string, unknown]> = []
    for (const fieldKey of expectedFields) {
      if (fieldKey in flattenedData) {
        orderedFields.push([fieldKey, flattenedData[fieldKey]])
      }
    }
    for (const [key, value] of Object.entries(flattenedData)) {
      if (!expectedFieldsSet.has(key)) {
        orderedFields.push([key, value])
      }
    }

    // Build grouped sections for rendering
    const docGroups = DOC_TYPE_FIELD_GROUPS[doc.docType] || []
    const groupedKeys = new Set(docGroups.flatMap((g) => g.fields))

    const sections = docGroups
      .map((group) => {
        const gFields = group.fields
          .filter((key) => key in flattenedData)
          .map((key) => [key, flattenedData[key]] as [string, unknown])
        return { group, fields: gFields }
      })
      .filter((s) => s.fields.length > 0)

    // Ungrouped: fields in orderedFields but not in any group
    const ungrouped = orderedFields.filter(([key]) => !groupedKeys.has(key))

    // Build O(1) lookup map for flat index (keyboard navigation)
    const indexMap = new Map<string, number>()
    orderedFields.forEach(([key], idx) => indexMap.set(key, idx))

    return {
      fields: orderedFields,
      fieldVerifications: verifications,
      groupedSections: sections,
      ungroupedFields: ungrouped,
      fieldIndexMap: indexMap,
    }
  }, [extractedData, doc.fieldVerifications, doc.docType, localVerifications, localEditedValues])

  // AI confidence - reuse memoized extractedData (used in empty state message)
  const extractedConfidence = extractedData.aiConfidence
  const aiConfidence = doc.aiConfidence ?? (isNumber(extractedConfidence) ? extractedConfidence : 0)

  // Field verification mutation with optimistic updates
  const verifyFieldMutation = useMutation({
    mutationFn: (payload: { field: string; status: FieldVerificationStatus; value?: string }) =>
      api.docs.verifyField(doc.id, payload),
    onMutate: async ({ field, status, value }) => {
      // Instant local state update for immediate UI feedback
      setLocalVerifications((prev) => ({ ...prev, [field]: status }))

      // Save edited value locally to prevent revert on query refetch
      if (value !== undefined) {
        setLocalEditedValues((prev) => ({ ...prev, [field]: value }))
      }

      // Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey: ['case', caseId] })

      // Snapshot previous value
      const previousCase = queryClient.getQueryData(['case', caseId])
      const previousLocalVerifications = { ...localVerifications }
      const previousLocalEditedValues = { ...localEditedValues }

      // Optimistically update query cache too
      queryClient.setQueryData(['case', caseId], (old: unknown) => {
        if (!isRecord(old)) return old
        const digitalDocs = Array.isArray(old.digitalDocs) ? old.digitalDocs : []
        return {
          ...old,
          digitalDocs: digitalDocs.map((d: unknown) => {
            if (!isRecord(d) || d.id !== doc.id) return d
            const currentVerifications = isRecord(d.fieldVerifications) ? d.fieldVerifications : {}
            const currentExtracted = isRecord(d.extractedData) ? d.extractedData : {}
            return {
              ...d,
              fieldVerifications: { ...currentVerifications, [field]: status },
              extractedData: value ? { ...currentExtracted, [field]: value } : currentExtracted,
            }
          }),
        }
      })

      return { previousCase, previousLocalVerifications, previousLocalEditedValues }
    },
    onSuccess: () => {
      // Move to next unverified field
      const nextUnverified = fields.findIndex(
        ([key], idx) => idx > currentFieldIndex && !fieldVerifications[key]
      )
      if (nextUnverified !== -1) {
        setCurrentFieldIndex(nextUnverified)
      }
    },
    onError: (_error, variables, context) => {
      // Rollback local state on error
      if (context?.previousLocalVerifications) {
        setLocalVerifications(context.previousLocalVerifications)
      }
      if (context?.previousLocalEditedValues) {
        setLocalEditedValues(context.previousLocalEditedValues)
      }
      // Rollback query cache on error
      if (context?.previousCase) {
        queryClient.setQueryData(['case', caseId], context.previousCase)
      }
      toast.error(`${MESSAGES.VERIFY_ERROR}: ${variables.field}`)
    },
    onSettled: () => {
      // Invalidate to ensure sync
      queryClient.invalidateQueries({ queryKey: ['case', caseId] })
    },
  })

  // Complete verification mutation
  const completeMutation = useMutation({
    mutationFn: () => api.docs.verifyAction(doc.id, { action: 'verify' }),
    onSuccess: () => {
      toast.success(MESSAGES.COMPLETE_SUCCESS)
      queryClient.invalidateQueries({ queryKey: ['case', caseId] })
      onClose()
    },
    onError: () => {
      toast.error(MESSAGES.COMPLETE_ERROR)
    },
  })

  // OCR extraction mutation
  const extractMutation = useMutation({
    mutationFn: () => api.docs.triggerOcr(doc.id),
    onSuccess: (data) => {
      if (data.aiConfigured === false) {
        toast.error(MESSAGES.EXTRACT_AI_NOT_CONFIGURED)
        return
      }
      if (data.ocrResult?.success) {
        toast.success(`${MESSAGES.EXTRACT_SUCCESS} (${Math.round(data.ocrResult.confidence * 100)}%)`)
      } else {
        // Parse error message to user-friendly Vietnamese
        const errorMsg = parseOcrError(data.message || '')
        toast.error(errorMsg)
      }
      // Invalidate to refresh extracted data
      queryClient.invalidateQueries({ queryKey: ['case', caseId] })
    },
    onError: () => {
      toast.error(MESSAGES.EXTRACT_ERROR)
    },
  })

  // Handle field verification
  const handleVerifyField = useCallback(
    (fieldKey: string, status: FieldVerificationStatus, newValue?: string) => {
      verifyFieldMutation.mutate({ field: fieldKey, status, value: newValue })
    },
    [verifyFieldMutation]
  )

  // Handle complete verification - auto-verifies all remaining fields
  const handleComplete = useCallback(() => {
    completeMutation.mutate()
  }, [completeMutation])

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close (only when not editing a field)
      // When in an input, FieldVerificationItem handles Escape to cancel edit
      if (e.key === 'Escape') {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          onClose()
        }
        return
      }

      // Tab to navigate fields (when not in an input)
      if (e.key === 'Tab' && !e.shiftKey) {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault()
          const nextIndex = (currentFieldIndex + 1) % fields.length
          setCurrentFieldIndex(nextIndex)
        }
      }

      // Shift+Tab to navigate backwards
      if (e.key === 'Tab' && e.shiftKey) {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault()
          const prevIndex = currentFieldIndex === 0 ? fields.length - 1 : currentFieldIndex - 1
          setCurrentFieldIndex(prevIndex)
        }
      }

      // Enter to complete
      if (e.key === 'Enter' && !completeMutation.isPending) {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault()
          handleComplete()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, currentFieldIndex, fields.length, completeMutation.isPending, handleComplete])

  // Reset state when modal opens or doc changes
  // Note: setState is intentional here to sync internal state with prop changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isOpen) {
      setCurrentFieldIndex(0)
      setLocalVerifications({}) // Clear local optimistic state for fresh doc
      setLocalEditedValues({}) // Clear local edited values for fresh doc
    }
  }, [isOpen, doc.id])
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!isOpen) return null

  const docLabel = DOC_TYPE_LABELS[doc.docType] || doc.docType
  const isPdf = doc.rawImage?.r2Key?.endsWith('.pdf')

  // URL validation
  const validatedUrl =
    signedUrlData?.url && isValidSignedUrl(signedUrlData.url) ? signedUrlData.url : null

  // Use portal to render at document.body level to avoid stacking context issues
  return createPortal(
    <>
      {/* Backdrop - covers entire viewport */}
      <div
        className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal - Near fullscreen */}
      <div
        className="fixed inset-2 md:inset-4 z-[100] flex flex-col bg-card rounded-xl border border-border shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="verification-modal-title"
      >
        {/* Header - Enhanced with gradient */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2
                id="verification-modal-title"
                className="text-lg font-bold text-foreground"
              >
                {docLabel}
              </h2>
              <p className="text-xs text-muted-foreground">
                Xác minh thông tin trích xuất
              </p>
            </div>
            <div className="flex items-center gap-2 ml-2">
              {doc.status === 'VERIFIED' && (
                <Badge variant="success" className="text-xs">
                  Đã xác minh
                </Badge>
              )}
              {doc.status === 'PARTIAL' && (
                <Badge variant="warning" className="text-xs">
                  Thiếu dữ liệu
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => extractMutation.mutate()}
              disabled={extractMutation.isPending}
              className="gap-1.5 px-4"
            >
              {extractMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang trích xuất...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Trích xuất
                </>
              )}
            </Button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted/80 transition-colors"
              aria-label="Đóng"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content - Split view (60/40 for better document viewing) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left: Image Viewer - Larger space for document */}
          <div className="h-1/2 md:h-full md:w-[60%] border-b md:border-b-0 md:border-r border-border bg-muted/20">
            {isUrlLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
              </div>
            ) : urlError || !validatedUrl ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                  <ImageOff className="w-8 h-8" />
                </div>
                <p className="text-sm font-medium">Không thể tải hình ảnh</p>
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

          {/* Right: Verification Panel */}
          <div className="h-1/2 md:h-full md:w-[40%] flex flex-col overflow-hidden bg-card">
            {/* Status bar */}
            <div className="px-4 py-3 border-b border-border bg-muted/10">
              <div className="flex items-center gap-2">
                {doc.status === 'VERIFIED' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <Clock className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-sm font-medium text-foreground">
                  {doc.status === 'PARTIAL' && 'Một số trường không đọc được'}
                  {doc.status === 'EXTRACTED' && 'Đang chờ xác minh'}
                  {doc.status === 'PENDING' && 'Đang xử lý'}
                  {doc.status === 'VERIFIED' && 'Đã xác minh'}
                </span>
              </div>
            </div>

            {/* Fields list - Enhanced layout */}
            <div className="flex-1 overflow-y-auto p-3">
              {fields.length === 0 ? (
                <div className="text-center py-12 px-4 text-muted-foreground">
                  <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <p className="font-medium text-base">Không có dữ liệu được trích xuất</p>
                  <p className="text-sm mt-2 text-muted-foreground">
                    {aiConfidence === 0
                      ? 'AI đang gặp sự cố. Vui lòng thử lại sau hoặc nhập liệu thủ công.'
                      : 'Tài liệu chưa được xử lý OCR hoặc không hỗ trợ loại này.'}
                  </p>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => extractMutation.mutate()}
                    disabled={extractMutation.isPending}
                    className="mt-6 gap-2 px-6"
                  >
                    {extractMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Đang trích xuất...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Trích xuất bằng AI
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Grouped sections */}
                  {groupedSections.map(({ group, fields: groupFields }) => {
                    const Icon = group.icon
                    return (
                      <section key={group.key} className="rounded-lg border border-border overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-1.5 border-l-4 border-l-primary bg-muted/20">
                          <div className="p-1 rounded-md bg-primary/10 text-primary">
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {group.label}
                          </span>
                          <span className="text-xs text-muted-foreground">({groupFields.length})</span>
                        </div>
                        <div className="divide-y divide-border/50">
                          {groupFields.map(([key, value]) => {
                            const flatIndex = fieldIndexMap.get(key) ?? -1
                            return (
                              <div
                                key={key}
                                className={cn(
                                  'transition-colors',
                                  flatIndex === currentFieldIndex && 'bg-primary/5',
                                  fieldVerifications[key] && 'bg-green-500/5'
                                )}
                              >
                                <FieldVerificationItem
                                  fieldKey={key}
                                  label={getFieldLabelForDocType(key, doc.docType)}
                                  value={String(value ?? '')}
                                  status={fieldVerifications[key] || null}
                                  onVerify={(status, newValue) => handleVerifyField(key, status, newValue)}
                                  disabled={verifyFieldMutation.isPending}
                                />
                              </div>
                            )
                          })}
                        </div>
                      </section>
                    )
                  })}

                  {/* Ungrouped fields */}
                  {ungroupedFields.length > 0 && (
                    <section className="rounded-lg border border-border overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-1.5 border-l-4 border-l-primary bg-muted/20">
                        <div className="p-1 rounded-md bg-primary/10 text-primary">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Thông tin khác
                        </span>
                        <span className="text-xs text-muted-foreground">({ungroupedFields.length})</span>
                      </div>
                      <div className="divide-y divide-border/50">
                        {ungroupedFields.map(([key, value]) => {
                          const flatIndex = fieldIndexMap.get(key) ?? -1
                          return (
                            <div
                              key={key}
                              className={cn(
                                'transition-colors',
                                flatIndex === currentFieldIndex && 'bg-primary/5',
                                fieldVerifications[key] && 'bg-green-500/5'
                              )}
                            >
                              <FieldVerificationItem
                                fieldKey={key}
                                label={getFieldLabelForDocType(key, doc.docType)}
                                value={String(value ?? '')}
                                status={fieldVerifications[key] || null}
                                onVerify={(status, newValue) => handleVerifyField(key, status, newValue)}
                                disabled={verifyFieldMutation.isPending}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </div>

            {/* Footer - Enhanced */}
            <div className="px-4 py-3 border-t border-border bg-gradient-to-r from-muted/30 to-transparent">
              <Button
                size="default"
                onClick={handleComplete}
                disabled={completeMutation.isPending}
                className="w-full h-11 text-sm font-semibold gap-2"
              >
                {completeMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Hoàn tất xác minh
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
