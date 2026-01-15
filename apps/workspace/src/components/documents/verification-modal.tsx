/**
 * VerificationModal - Split-screen modal for document field verification
 * Left panel: Zoomable image viewer
 * Right panel: Field verification controls with progress tracking
 * Features: auto-save on blur, optimistic updates, keyboard shortcuts
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, AlertTriangle, ImageOff, RefreshCw } from 'lucide-react'
import { cn, Badge, Button } from '@ella/ui'
import { ImageViewer } from '../ui/image-viewer'
import { FieldVerificationItem } from '../ui/field-verification-item'
import { ProgressIndicator } from '../ui/progress-indicator'
import { DOC_TYPE_LABELS } from '../../lib/constants'
import { getFieldLabel, isExcludedField } from '../../lib/field-labels'
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
  /** Callback when re-upload request is needed */
  onRequestReupload?: (doc: DigitalDoc, unreadableFields: string[]) => void
}

// Vietnamese toast messages
const MESSAGES = {
  VERIFY_SUCCESS: 'Đã xác minh trường',
  VERIFY_ERROR: 'Lỗi xác minh trường',
  COMPLETE_SUCCESS: 'Đã hoàn tất xác minh tài liệu',
  COMPLETE_ERROR: 'Lỗi hoàn tất xác minh',
  ALL_FIELDS_REQUIRED: 'Vui lòng xác minh tất cả các trường',
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
  onRequestReupload,
}: VerificationModalProps) {
  const queryClient = useQueryClient()
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0)

  // Get signed URL for image
  const rawImageId = doc.rawImage?.id || doc.rawImageId
  const {
    data: signedUrlData,
    isLoading: isUrlLoading,
    error: urlError,
    refetch: refetchUrl,
  } = useSignedUrl(rawImageId, { enabled: isOpen && !!rawImageId })

  // Extract and filter fields from extractedData
  const { fields, fieldVerifications } = useMemo(() => {
    const extractedData = isRecord(doc.extractedData) ? doc.extractedData : {}
    const verifications = isRecord(doc.fieldVerifications)
      ? (doc.fieldVerifications as Record<string, FieldVerificationStatus>)
      : {}

    // Filter out metadata fields
    const fieldEntries = Object.entries(extractedData).filter(
      ([key]) => !isExcludedField(key) && typeof extractedData[key] !== 'object'
    )

    return {
      fields: fieldEntries,
      fieldVerifications: verifications,
    }
  }, [doc.extractedData, doc.fieldVerifications])

  // Calculate progress
  const totalFields = fields.length
  const verifiedCount = fields.filter(([key]) => fieldVerifications[key]).length
  const allVerified = totalFields > 0 && verifiedCount === totalFields
  const hasUnreadable = Object.values(fieldVerifications).includes('unreadable')

  // AI confidence
  const extractedData = isRecord(doc.extractedData) ? doc.extractedData : {}
  const extractedConfidence = extractedData.aiConfidence
  const aiConfidence = doc.aiConfidence ?? (isNumber(extractedConfidence) ? extractedConfidence : 0)
  const confidencePercent = Math.round(aiConfidence * 100)

  // Field verification mutation with optimistic updates
  const verifyFieldMutation = useMutation({
    mutationFn: (payload: { field: string; status: FieldVerificationStatus; value?: string }) =>
      api.docs.verifyField(doc.id, payload),
    onMutate: async ({ field, status, value }) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey: ['case', caseId] })

      // Snapshot previous value
      const previousCase = queryClient.getQueryData(['case', caseId])

      // Optimistically update
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

      return { previousCase }
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
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousCase) {
        queryClient.setQueryData(['case', caseId], context.previousCase)
      }
      toast.error(MESSAGES.VERIFY_ERROR)
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

  // Handle field verification
  const handleVerifyField = useCallback(
    (fieldKey: string, status: FieldVerificationStatus, newValue?: string) => {
      verifyFieldMutation.mutate({ field: fieldKey, status, value: newValue })
    },
    [verifyFieldMutation]
  )

  // Handle complete verification
  const handleComplete = useCallback(() => {
    if (!allVerified) {
      toast.error(MESSAGES.ALL_FIELDS_REQUIRED)
      return
    }
    completeMutation.mutate()
  }, [allVerified, completeMutation])

  // Handle request re-upload
  const handleRequestReupload = useCallback(() => {
    const unreadableFields = Object.entries(fieldVerifications)
      .filter(([_, status]) => status === 'unreadable')
      .map(([key]) => key)
    onRequestReupload?.(doc, unreadableFields)
  }, [doc, fieldVerifications, onRequestReupload])

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

      // Enter to complete when all verified
      if (e.key === 'Enter' && allVerified && !completeMutation.isPending) {
        e.preventDefault()
        handleComplete()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, currentFieldIndex, fields.length, allVerified, completeMutation.isPending, handleComplete])

  // Reset state when modal opens
  // Note: setState is intentional here to sync internal state with prop changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isOpen) {
      setCurrentFieldIndex(0)
    }
  }, [isOpen])
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!isOpen) return null

  const docLabel = DOC_TYPE_LABELS[doc.docType] || doc.docType
  const isPdf = doc.rawImage?.r2Key?.endsWith('.pdf')

  // URL validation
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
        aria-labelledby="verification-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <h2
              id="verification-modal-title"
              className="text-lg font-semibold text-foreground"
            >
              {docLabel}
            </h2>
            <Badge variant="outline" className="text-xs">
              AI {confidencePercent}%
            </Badge>
            {doc.status === 'PARTIAL' && (
              <Badge variant="warning" className="text-xs">
                Thiếu dữ liệu
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

        {/* Content - Split view */}
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

          {/* Right: Verification Panel */}
          <div className="h-1/2 md:h-full md:w-1/2 flex flex-col overflow-hidden">
            {/* Status info */}
            <div className="px-4 py-3 border-b border-border bg-muted/10">
              <p className="text-sm text-secondary">
                {doc.status === 'PARTIAL' && 'Một số trường không đọc được'}
                {doc.status === 'EXTRACTED' && 'Đang chờ xác minh'}
                {doc.status === 'PENDING' && 'Đang xử lý'}
                {doc.status === 'VERIFIED' && 'Đã xác minh'}
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
                fields.map(([key, value], index) => (
                  <div
                    key={key}
                    className={cn(
                      'transition-all',
                      index === currentFieldIndex && 'ring-2 ring-primary ring-offset-2 rounded-lg'
                    )}
                  >
                    <FieldVerificationItem
                      fieldKey={key}
                      label={getFieldLabel(key)}
                      value={String(value ?? '')}
                      status={fieldVerifications[key] || null}
                      onVerify={(status, newValue) => handleVerifyField(key, status, newValue)}
                      disabled={verifyFieldMutation.isPending}
                    />
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-border bg-muted/10 space-y-3">
              {/* Progress */}
              <ProgressIndicator
                current={verifiedCount}
                total={totalFields}
                label="Tiến độ xác minh"
              />

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleRequestReupload}
                  disabled={!hasUnreadable || !onRequestReupload}
                  className="flex-1"
                >
                  Yêu cầu tải lại ảnh
                </Button>
                <Button
                  onClick={handleComplete}
                  disabled={!allVerified || completeMutation.isPending}
                  className="flex-1"
                >
                  {completeMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    'Hoàn tất xác minh'
                  )}
                </Button>
              </div>

              {/* Keyboard hints */}
              <p className="text-xs text-muted-foreground text-center">
                Tab = Trường tiếp theo • Enter = Hoàn tất • Esc = Đóng
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
