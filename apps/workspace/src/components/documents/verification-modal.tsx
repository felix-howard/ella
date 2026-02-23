/**
 * VerificationModal - Split-screen modal for document field verification
 * Left panel: Zoomable image viewer
 * Right panel: Field verification controls with progress tracking
 * Features: auto-save on blur, optimistic updates, keyboard shortcuts
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { X, Loader2, AlertTriangle, ImageOff, RefreshCw, Sparkles, FileCheck, FileText, CheckCircle2, Clock, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, Badge, Button } from '@ella/ui'
import { ImageViewer } from '../ui/image-viewer'
import { FieldVerificationItem } from '../ui/field-verification-item'
import { DOC_TYPE_LABELS } from '../../lib/constants'
import { getFieldLabelForDocType, isExcludedField } from '../../lib/field-labels'
import { getDocTypeFields } from '../../lib/doc-type-fields'
import { DOC_TYPE_FIELD_GROUPS } from '../../lib/doc-type-field-groups'
import { api, fetchMediaBlobUrl, type DigitalDoc, type FieldVerificationStatus } from '../../lib/api-client'
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
  /** Navigate to previous file (undefined if at first) */
  onNavigatePrev?: () => void
  /** Navigate to next file (undefined if at last) */
  onNavigateNext?: () => void
  /** Current file index (0-based) */
  currentIndex?: number
  /** Total number of files */
  totalCount?: number
}

/**
 * Parse OCR error message to user-friendly message using translation function
 */
function parseOcrError(message: string, t: (key: string) => string): string {
  if (message.includes('429') || message.includes('quota') || message.includes('rate')) {
    return t('verificationModal.extractRateLimit')
  }
  if (message.includes('UNSUPPORTED_DOC_TYPE') || message.includes('does not support OCR')) {
    return t('verificationModal.extractUnsupported')
  }
  if (message.includes('AI not configured')) {
    return t('verificationModal.extractAiNotConfigured')
  }
  // Default short error
  return t('verificationModal.extractError')
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
  onNavigatePrev,
  onNavigateNext,
  currentIndex,
  totalCount,
}: VerificationModalProps) {
  const { t } = useTranslation()
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
      toast.error(`${t('verificationModal.verifyFieldError')}: ${variables.field}`)
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
      toast.success(t('verificationModal.completeSuccess'))
      queryClient.invalidateQueries({ queryKey: ['case', caseId] })
      onClose()
    },
    onError: () => {
      toast.error(t('verificationModal.completeError'))
    },
  })

  // OCR extraction mutation
  const extractMutation = useMutation({
    mutationFn: () => api.docs.triggerOcr(doc.id),
    onSuccess: (data) => {
      if (data.aiConfigured === false) {
        toast.error(t('verificationModal.extractAiNotConfigured'))
        return
      }
      if (data.ocrResult?.success) {
        toast.success(`${t('verificationModal.extractSuccess')} (${Math.round(data.ocrResult.confidence * 100)}%)`)
      } else {
        // Parse error message to user-friendly message
        const errorMsg = parseOcrError(data.message || '', t)
        toast.error(errorMsg)
      }
      // Invalidate to refresh extracted data
      queryClient.invalidateQueries({ queryKey: ['case', caseId] })
    },
    onError: () => {
      toast.error(t('verificationModal.extractError'))
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

  // Handle download file
  const handleDownload = useCallback(async () => {
    if (!rawImageId) {
      toast.error(t('fileActions.cannotDownloadFile'))
      return
    }
    try {
      const blobUrl = await fetchMediaBlobUrl(`/cases/images/${rawImageId}/file`)
      const link = document.createElement('a')
      link.href = blobUrl
      // Get display name from displayName, r2Key (formatted name), or original filename
      let downloadName = doc.rawImage?.displayName
      if (!downloadName && doc.rawImage?.r2Key) {
        const parts = doc.rawImage.r2Key.split('/')
        downloadName = parts[parts.length - 1]
      }
      link.download = downloadName || doc.rawImage?.filename || 'document'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch {
      toast.error(t('fileActions.cannotDownloadFile'))
    }
  }, [rawImageId, doc.rawImage, t])

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

      // Arrow left/right to navigate between files (when not in input)
      const target = e.target as HTMLElement
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
        if (e.key === 'ArrowLeft' && onNavigatePrev) {
          e.preventDefault()
          onNavigatePrev()
          return
        }
        if (e.key === 'ArrowRight' && onNavigateNext) {
          e.preventDefault()
          onNavigateNext()
          return
        }
      }

      // Tab to navigate fields (when not in an input)
      if (e.key === 'Tab' && !e.shiftKey) {
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault()
          const nextIndex = (currentFieldIndex + 1) % fields.length
          setCurrentFieldIndex(nextIndex)
        }
      }

      // Shift+Tab to navigate backwards
      if (e.key === 'Tab' && e.shiftKey) {
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault()
          const prevIndex = currentFieldIndex === 0 ? fields.length - 1 : currentFieldIndex - 1
          setCurrentFieldIndex(prevIndex)
        }
      }

      // Enter to complete
      if (e.key === 'Enter' && !completeMutation.isPending) {
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault()
          handleComplete()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, currentFieldIndex, fields.length, completeMutation.isPending, handleComplete, onNavigatePrev, onNavigateNext])

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

  // Get display name: prefer displayName, then extract from r2Key (formatted name), then original filename
  const getDisplayName = () => {
    if (doc.rawImage?.displayName) return doc.rawImage.displayName
    // Extract formatted name from r2Key (e.g., "cases/.../docs/2024_W2_Name.pdf" -> "2024_W2_Name.pdf")
    if (doc.rawImage?.r2Key) {
      const parts = doc.rawImage.r2Key.split('/')
      const fileName = parts[parts.length - 1]
      if (fileName) return fileName
    }
    return doc.rawImage?.filename || docLabel
  }
  const modalTitle = getDisplayName()

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
                {modalTitle}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t('verificationModal.verifyInfo')}
              </p>
            </div>
            <div className="flex items-center gap-2 ml-2">
              {doc.status === 'VERIFIED' && (
                <Badge variant="success" className="text-xs">
                  {t('checklistStatus.verified')}
                </Badge>
              )}
              {doc.status === 'PARTIAL' && (
                <Badge variant="warning" className="text-xs">
                  {t('verificationModal.partialExtract')}
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
                  {t('uploadProgress.extracting')}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {t('digitalDoc.extracted')}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!rawImageId}
              className="gap-1.5 px-4"
            >
              <Download className="w-4 h-4" />
              {t('fileActions.download')}
            </Button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted/80 transition-colors"
              aria-label={t('common.close')}
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content - Split view (70/30 for maximum document viewing) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left: Image Viewer - Larger space for document */}
          <div className="h-1/2 md:h-full md:w-[70%] border-b md:border-b-0 md:border-r border-border bg-muted/20 relative">
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

            {/* Navigation Arrows - Floating on the image viewer */}
            {(onNavigatePrev || onNavigateNext) && (
              <>
                {/* Previous button */}
                <button
                  onClick={onNavigatePrev}
                  disabled={!onNavigatePrev}
                  className={cn(
                    'absolute left-3 top-1/2 -translate-y-1/2 z-10',
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    'bg-background/90 border border-border shadow-lg',
                    'transition-all hover:bg-background hover:scale-105',
                    !onNavigatePrev && 'opacity-30 cursor-not-allowed hover:scale-100'
                  )}
                  aria-label={t('common.previous')}
                  title={`${t('common.previous')} (←)`}
                >
                  <ChevronLeft className="w-5 h-5 text-foreground" />
                </button>

                {/* Next button */}
                <button
                  onClick={onNavigateNext}
                  disabled={!onNavigateNext}
                  className={cn(
                    'absolute right-3 top-1/2 -translate-y-1/2 z-10',
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    'bg-background/90 border border-border shadow-lg',
                    'transition-all hover:bg-background hover:scale-105',
                    !onNavigateNext && 'opacity-30 cursor-not-allowed hover:scale-100'
                  )}
                  aria-label={t('common.next')}
                  title={`${t('common.next')} (→)`}
                >
                  <ChevronRight className="w-5 h-5 text-foreground" />
                </button>

                {/* File counter */}
                {currentIndex !== undefined && totalCount !== undefined && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full bg-background/90 border border-border shadow-lg text-xs font-medium text-foreground">
                    {currentIndex + 1} / {totalCount}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right: Verification Panel */}
          <div className="h-1/2 md:h-full md:w-[30%] flex flex-col overflow-hidden bg-card">
            {/* Status bar */}
            <div className="px-4 py-3 border-b border-border bg-muted/10">
              <div className="flex items-center gap-2">
                {doc.status === 'VERIFIED' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <Clock className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-sm font-medium text-foreground">
                  {doc.status === 'PARTIAL' && t('verificationModal.partialExtract')}
                  {doc.status === 'EXTRACTED' && t('verificationModal.waitingVerification')}
                  {doc.status === 'PENDING' && t('uploads.statusProcessing')}
                  {doc.status === 'VERIFIED' && t('checklistStatus.verified')}
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
                  <p className="font-medium text-base">{t('verificationModal.noExtractedData')}</p>
                  <p className="text-sm mt-2 text-muted-foreground">
                    {aiConfidence === 0
                      ? t('verificationModal.aiError')
                      : t('verificationModal.noOcrSupport')}
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
                        {t('uploadProgress.extracting')}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        {t('verificationModal.extractWithAi')}
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
                          {t('dataEntry.otherInfo')}
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
                    {t('common.loading')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {t('verificationModal.complete')}
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
