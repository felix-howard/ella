/**
 * Classification Review Modal - Review and approve/correct AI document classification
 * Opens for medium-confidence images (60-85%) to allow CPA verification
 */

import { useState, useEffect, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, X, Loader2, Image as ImageIcon, ChevronDown, AlertCircle } from 'lucide-react'
import { cn } from '@ella/ui'
import { DOC_TYPE_LABELS, getConfidenceLevel } from '../../lib/constants'
import { api, type RawImage } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { useSignedUrl } from '../../hooks/use-signed-url'

interface ClassificationReviewModalProps {
  image: RawImage | null
  isOpen: boolean
  onClose: () => void
  caseId: string
}

// DocTypes that support OCR extraction
const SUPPORTED_DOC_TYPES = [
  'SSN_CARD',
  'DRIVER_LICENSE',
  'W2',
  'FORM_1099_INT',
  'FORM_1099_DIV',
  'FORM_1099_NEC',
  'FORM_1099_MISC',
  'FORM_1099_K',
  'FORM_1099_R',
  'FORM_1099_G',
  'FORM_1099_SSA',
  'BANK_STATEMENT',
  'PROFIT_LOSS_STATEMENT',
  'BUSINESS_LICENSE',
  'EIN_LETTER',
  'FORM_1098',
  'FORM_1098_T',
  'RECEIPT',
  'BIRTH_CERTIFICATE',
  'DAYCARE_RECEIPT',
  'PASSPORT',
  'OTHER',
] as const

// Vietnamese toast messages
const MESSAGES = {
  APPROVE_SUCCESS: 'Đã xác nhận phân loại',
  REJECT_SUCCESS: 'Đã từ chối - yêu cầu gửi lại',
  UPDATE_ERROR: 'Lỗi cập nhật phân loại',
}

/**
 * Validate signed URL to prevent XSS attacks
 * Only allows HTTPS URLs from trusted cloud storage providers
 */
function isValidSignedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    // Allow common cloud storage hostnames
    const trustedHosts = [
      '.r2.cloudflarestorage.com',
      '.amazonaws.com',
      '.storage.googleapis.com',
      '.blob.core.windows.net',
    ]
    return trustedHosts.some(host => parsed.hostname.endsWith(host))
  } catch {
    return false
  }
}

export function ClassificationReviewModal({
  image,
  isOpen,
  onClose,
  caseId,
}: ClassificationReviewModalProps) {
  const queryClient = useQueryClient()
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [imageError, setImageError] = useState(false)

  // Fetch signed URL for image preview
  const { data: signedUrlData, isLoading: isUrlLoading, error: urlError } = useSignedUrl(
    image?.id ?? null,
    { enabled: isOpen && !!image }
  )

  // Reset state when image changes
  // Note: setState is intentional here to sync internal state with prop changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setSelectedDocType(image?.classifiedType || null)
    setIsDropdownOpen(false)
    setImageError(false)
  }, [image])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Mutation for updating classification with optimistic update
  const updateMutation = useMutation({
    mutationFn: (data: { docType: string; action: 'approve' | 'reject' }) =>
      api.images.updateClassification(image!.id, data),
    onMutate: async (variables) => {
      // Cancel in-flight queries
      await queryClient.cancelQueries({ queryKey: ['images', caseId] })

      // Snapshot previous value
      const previousImages = queryClient.getQueryData(['images', caseId])

      // Optimistically update
      queryClient.setQueryData(['images', caseId], (old: { images: RawImage[] } | undefined) => {
        if (!old) return old
        return {
          ...old,
          images: old.images.map((img) =>
            img.id === image!.id
              ? {
                  ...img,
                  classifiedType: variables.docType,
                  aiConfidence: 1.0,
                  status: variables.action === 'approve' ? 'LINKED' : 'BLURRY',
                }
              : img
          ),
        }
      })

      return { previousImages }
    },
    onSuccess: (_, variables) => {
      toast.success(variables.action === 'approve' ? MESSAGES.APPROVE_SUCCESS : MESSAGES.REJECT_SUCCESS)
      // Invalidate to ensure data sync
      queryClient.invalidateQueries({ queryKey: ['images', caseId] })
      queryClient.invalidateQueries({ queryKey: ['checklist', caseId] })
      onClose()
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousImages) {
        queryClient.setQueryData(['images', caseId], context.previousImages)
      }
      toast.error(MESSAGES.UPDATE_ERROR)
    },
  })

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return

    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter' && selectedDocType && !updateMutation.isPending) {
      updateMutation.mutate({ docType: selectedDocType, action: 'approve' })
    }
  }, [isOpen, selectedDocType, onClose, updateMutation])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!isOpen || !image) return null

  const confidenceLevel = getConfidenceLevel(image.aiConfidence)
  const currentDocTypeLabel = image.classifiedType
    ? DOC_TYPE_LABELS[image.classifiedType] || image.classifiedType
    : 'Chưa phân loại'

  // Validate URL before rendering
  const validatedUrl = signedUrlData?.url && isValidSignedUrl(signedUrlData.url)
    ? signedUrlData.url
    : null

  // Determine image display state
  const showLoading = isUrlLoading
  const showError = imageError || urlError || (!isUrlLoading && signedUrlData?.url && !validatedUrl)
  const showImage = !showLoading && !showError && validatedUrl
  const showPlaceholder = !showLoading && !showError && !validatedUrl

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl bg-card rounded-xl border border-border shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 id="review-modal-title" className="text-lg font-semibold text-foreground">
            Xác minh phân loại
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Đóng"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Image Preview */}
            <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden">
              {showLoading && (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                </div>
              )}
              {showError && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-destructive">
                  <AlertCircle className="w-12 h-12" />
                  <span className="text-sm">Không thể tải ảnh</span>
                </div>
              )}
              {showImage && (
                <img
                  src={validatedUrl}
                  alt={image.filename}
                  className="w-full h-full object-contain"
                  onError={() => setImageError(true)}
                />
              )}
              {showPlaceholder && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                  <ImageIcon className="w-12 h-12 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{image.filename}</span>
                </div>
              )}
            </div>

            {/* Classification Details */}
            <div className="space-y-4">
              {/* Current AI Classification */}
              <div>
                <label className="text-sm text-muted-foreground">
                  Phân loại AI
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-medium text-foreground">
                    {currentDocTypeLabel}
                  </span>
                  {image.aiConfidence !== null && (
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      confidenceLevel.bg,
                      confidenceLevel.color
                    )}>
                      {Math.round(image.aiConfidence * 100)}% - {confidenceLevel.label}
                    </span>
                  )}
                </div>
              </div>

              {/* DocType Selector */}
              <div>
                <label className="text-sm text-muted-foreground">
                  Loại tài liệu
                </label>
                <div className="relative mt-1">
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 text-left',
                      'border border-border rounded-lg bg-background',
                      'hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
                    )}
                  >
                    <span className={selectedDocType ? 'text-foreground' : 'text-muted-foreground'}>
                      {selectedDocType ? DOC_TYPE_LABELS[selectedDocType] || selectedDocType : 'Chọn loại tài liệu'}
                    </span>
                    <ChevronDown className={cn(
                      'w-4 h-4 text-muted-foreground transition-transform',
                      isDropdownOpen && 'rotate-180'
                    )} />
                  </button>

                  {/* Dropdown */}
                  {isDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-auto">
                      {SUPPORTED_DOC_TYPES.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setSelectedDocType(type)
                            setIsDropdownOpen(false)
                          }}
                          className={cn(
                            'w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors',
                            selectedDocType === type && 'bg-primary-light text-primary'
                          )}
                        >
                          {DOC_TYPE_LABELS[type] || type}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Filename */}
              <div>
                <label className="text-sm text-muted-foreground">
                  Tên tệp
                </label>
                <p className="text-sm font-mono text-foreground mt-1 truncate">
                  {image.filename}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    if (selectedDocType) {
                      updateMutation.mutate({ docType: selectedDocType, action: 'approve' })
                    }
                  }}
                  disabled={!selectedDocType || updateMutation.isPending}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-2.5',
                    'bg-success text-white rounded-lg',
                    'hover:bg-success/90 disabled:opacity-50 disabled:cursor-not-allowed',
                    'transition-colors'
                  )}
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Xác nhận
                </button>
                <button
                  onClick={() => {
                    if (selectedDocType) {
                      updateMutation.mutate({ docType: selectedDocType, action: 'reject' })
                    }
                  }}
                  disabled={updateMutation.isPending}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-2.5',
                    'bg-destructive text-white rounded-lg',
                    'hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed',
                    'transition-colors'
                  )}
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                  Từ chối
                </button>
              </div>

              {/* Keyboard hint */}
              <p className="text-xs text-muted-foreground text-center">
                Enter = Xác nhận • Esc = Đóng
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
