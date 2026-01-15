/**
 * Manual Classification Modal - Manually classify unclassified documents
 * Opens for UPLOADED/UNCLASSIFIED images when AI failed or needs manual intervention
 * Features: Document type dropdown, retry AI button, notes field
 */

import { useState, useEffect, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  X,
  Loader2,
  Image as ImageIcon,
  ChevronDown,
  AlertCircle,
  RefreshCw,
  FileText,
  StickyNote,
} from 'lucide-react'
import { cn } from '@ella/ui'
import { DOC_TYPE_LABELS } from '../../lib/constants'
import { api, type RawImage } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { useSignedUrl } from '../../hooks/use-signed-url'

interface ManualClassificationModalProps {
  image: RawImage | null
  isOpen: boolean
  onClose: () => void
  caseId: string
}

// All supported document types for manual classification
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
  CLASSIFY_SUCCESS: 'Đã phân loại thành công',
  CLASSIFY_ERROR: 'Lỗi phân loại tài liệu',
  RETRY_SUCCESS: 'Đã gửi yêu cầu phân loại lại',
  RETRY_ERROR: 'Lỗi khi thử phân loại lại',
  SKIP_SUCCESS: 'Đã bỏ qua tài liệu',
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

/** Check if file is PDF */
function isPdfFile(filename: string): boolean {
  return filename.toLowerCase().endsWith('.pdf')
}

export function ManualClassificationModal({
  image,
  isOpen,
  onClose,
  caseId,
}: ManualClassificationModalProps) {
  const queryClient = useQueryClient()
  const [selectedDocType, setSelectedDocType] = useState<string | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [imageError, setImageError] = useState(false)

  // Fetch signed URL for preview
  const {
    data: signedUrlData,
    isLoading: isUrlLoading,
    error: urlError,
  } = useSignedUrl(image?.id ?? null, { enabled: isOpen && !!image })

  // Reset state when image changes
  // Note: setState is intentional here to sync internal state with prop changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setSelectedDocType(null)
    setIsDropdownOpen(false)
    setNotes('')
    setImageError(false)
  }, [image])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Mutation for manual classification (uses approve action)
  const classifyMutation = useMutation({
    mutationFn: (docType: string) =>
      api.images.updateClassification(image!.id, { docType, action: 'approve' }),
    onMutate: async (docType) => {
      await queryClient.cancelQueries({ queryKey: ['images', caseId] })
      const previousImages = queryClient.getQueryData(['images', caseId])

      // Optimistic update
      queryClient.setQueryData(
        ['images', caseId],
        (old: { images: RawImage[] } | undefined) => {
          if (!old) return old
          return {
            ...old,
            images: old.images.map((img) =>
              img.id === image!.id
                ? {
                    ...img,
                    classifiedType: docType,
                    aiConfidence: 1.0,
                    status: 'LINKED',
                  }
                : img
            ),
          }
        }
      )

      return { previousImages }
    },
    onSuccess: () => {
      toast.success(MESSAGES.CLASSIFY_SUCCESS)
      queryClient.invalidateQueries({ queryKey: ['images', caseId] })
      queryClient.invalidateQueries({ queryKey: ['checklist', caseId] })
      onClose()
    },
    onError: (_error, _docType, context) => {
      if (context?.previousImages) {
        queryClient.setQueryData(['images', caseId], context.previousImages)
      }
      toast.error(MESSAGES.CLASSIFY_ERROR)
    },
  })

  // Mutation for retry AI classification
  const retryMutation = useMutation({
    mutationFn: async () => {
      // Re-trigger classification by calling the reclassify endpoint
      const response = await fetch(`/api/images/${image!.id}/reclassify`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Reclassify failed')
      return response.json()
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['images', caseId] })
      const previousImages = queryClient.getQueryData(['images', caseId])

      // Optimistic update - set to PROCESSING
      queryClient.setQueryData(
        ['images', caseId],
        (old: { images: RawImage[] } | undefined) => {
          if (!old) return old
          return {
            ...old,
            images: old.images.map((img) =>
              img.id === image!.id ? { ...img, status: 'PROCESSING' } : img
            ),
          }
        }
      )

      return { previousImages }
    },
    onSuccess: () => {
      toast.success(MESSAGES.RETRY_SUCCESS)
      queryClient.invalidateQueries({ queryKey: ['images', caseId] })
      onClose()
    },
    onError: (_error, _vars, context) => {
      if (context?.previousImages) {
        queryClient.setQueryData(['images', caseId], context.previousImages)
      }
      toast.error(MESSAGES.RETRY_ERROR)
    },
  })

  // Mutation for skip/ignore (reject with current type)
  const skipMutation = useMutation({
    mutationFn: () =>
      api.images.updateClassification(image!.id, {
        docType: 'OTHER',
        action: 'reject',
      }),
    onSuccess: () => {
      toast.success(MESSAGES.SKIP_SUCCESS)
      queryClient.invalidateQueries({ queryKey: ['images', caseId] })
      onClose()
    },
    onError: () => {
      toast.error(MESSAGES.CLASSIFY_ERROR)
    },
  })

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === 'Escape') {
        onClose()
      } else if (
        e.key === 'Enter' &&
        selectedDocType &&
        !classifyMutation.isPending
      ) {
        classifyMutation.mutate(selectedDocType)
      }
    },
    [isOpen, selectedDocType, onClose, classifyMutation]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!isOpen || !image) return null

  const isPdf = isPdfFile(image.filename)
  const validatedUrl =
    signedUrlData?.url && isValidSignedUrl(signedUrlData.url)
      ? signedUrlData.url
      : null

  const showLoading = isUrlLoading
  const showError =
    imageError || urlError || (!isUrlLoading && signedUrlData?.url && !validatedUrl)
  const showImage = !showLoading && !showError && validatedUrl && !isPdf
  const showPdf = !showLoading && !showError && validatedUrl && isPdf
  const showPlaceholder = !showLoading && !showError && !validatedUrl

  const isPending =
    classifyMutation.isPending || retryMutation.isPending || skipMutation.isPending

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
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl bg-card rounded-xl border border-border shadow-xl max-h-[90vh] overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-classify-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <h2
            id="manual-classify-title"
            className="text-lg font-semibold text-foreground"
          >
            Phân loại thủ công
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
        <div className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* File Preview */}
            <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden">
              {showLoading && (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                </div>
              )}
              {showError && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-destructive">
                  <AlertCircle className="w-12 h-12" />
                  <span className="text-sm">Không thể tải tệp</span>
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
              {showPdf && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-white">
                  <FileText className="w-16 h-16 text-red-500" />
                  <span className="text-sm font-medium text-gray-700">PDF</span>
                  <a
                    href={validatedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    Mở trong tab mới
                  </a>
                </div>
              )}
              {showPlaceholder && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                  {isPdf ? (
                    <FileText className="w-12 h-12 text-muted-foreground" />
                  ) : (
                    <ImageIcon className="w-12 h-12 text-muted-foreground" />
                  )}
                  <span className="text-sm text-muted-foreground truncate max-w-full px-4">
                    {image.filename}
                  </span>
                </div>
              )}
            </div>

            {/* Classification Form */}
            <div className="space-y-4">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-error-light text-error">
                  Chưa phân loại
                </span>
                {image.status === 'UNCLASSIFIED' && (
                  <span className="text-xs text-muted-foreground">
                    AI không thể xác định
                  </span>
                )}
              </div>

              {/* DocType Selector */}
              <div>
                <label className="text-sm font-medium text-foreground">
                  Loại tài liệu <span className="text-error">*</span>
                </label>
                <div className="relative mt-1">
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    disabled={isPending}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2.5 text-left',
                      'border border-border rounded-lg bg-background',
                      'hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    <span
                      className={
                        selectedDocType ? 'text-foreground' : 'text-muted-foreground'
                      }
                    >
                      {selectedDocType
                        ? DOC_TYPE_LABELS[selectedDocType] || selectedDocType
                        : 'Chọn loại tài liệu...'}
                    </span>
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 text-muted-foreground transition-transform',
                        isDropdownOpen && 'rotate-180'
                      )}
                    />
                  </button>

                  {/* Dropdown */}
                  {isDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-auto">
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

              {/* Notes Field */}
              <div>
                <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                  <StickyNote className="w-4 h-4" />
                  Ghi chú (tùy chọn)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Thêm ghi chú về tài liệu này..."
                  disabled={isPending}
                  className={cn(
                    'w-full mt-1 px-3 py-2 text-sm',
                    'border border-border rounded-lg bg-background',
                    'placeholder:text-muted-foreground',
                    'focus:outline-none focus:ring-2 focus:ring-primary/20',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'resize-none h-20'
                  )}
                />
              </div>

              {/* Filename */}
              <div>
                <label className="text-sm text-muted-foreground">Tên tệp</label>
                <p className="text-sm font-mono text-foreground mt-1 truncate">
                  {image.filename}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                {/* Primary: Classify */}
                <button
                  onClick={() => {
                    if (selectedDocType) {
                      classifyMutation.mutate(selectedDocType)
                    }
                  }}
                  disabled={!selectedDocType || isPending}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 px-4 py-2.5',
                    'bg-primary text-white rounded-lg',
                    'hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed',
                    'transition-colors'
                  )}
                >
                  {classifyMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Phân loại
                </button>

                {/* Secondary Actions */}
                <div className="flex gap-2">
                  {/* Retry AI */}
                  <button
                    onClick={() => retryMutation.mutate()}
                    disabled={isPending}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 px-4 py-2',
                      'border border-border rounded-lg',
                      'hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed',
                      'transition-colors text-sm'
                    )}
                  >
                    {retryMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Thử lại AI
                  </button>

                  {/* Skip */}
                  <button
                    onClick={() => skipMutation.mutate()}
                    disabled={isPending}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 px-4 py-2',
                      'border border-destructive/30 text-destructive rounded-lg',
                      'hover:bg-destructive/5 disabled:opacity-50 disabled:cursor-not-allowed',
                      'transition-colors text-sm'
                    )}
                  >
                    {skipMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                    Bỏ qua
                  </button>
                </div>
              </div>

              {/* Keyboard hint */}
              <p className="text-xs text-muted-foreground text-center pt-2">
                Enter = Phân loại | Esc = Đóng
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
