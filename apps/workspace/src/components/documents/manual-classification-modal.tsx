/**
 * Manual Classification Modal - Manually classify unclassified documents
 * Opens for UPLOADED/UNCLASSIFIED images when AI failed or needs manual intervention
 * Features: Embedded PDF/image viewer with zoom, document type dropdown, rename, retry AI
 */

import { useState, useEffect, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  X,
  Loader2,
  ChevronDown,
  RefreshCw,
  StickyNote,
  ExternalLink,
  Pencil,
  FileQuestion,
} from 'lucide-react'
import { cn, Badge } from '@ella/ui'
import { ImageViewer } from '../ui/image-viewer'
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

  // Filename editing state
  const [isEditingFilename, setIsEditingFilename] = useState(false)
  const [editedFilename, setEditedFilename] = useState('')

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
    // Reset filename editing
    setIsEditingFilename(false)
    setEditedFilename(image?.filename || '')
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
      queryClient.invalidateQueries({ queryKey: ['docs', caseId] })
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
    mutationFn: () => api.images.reclassify(image!.id),
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

  // Mutation for renaming file
  const renameMutation = useMutation({
    mutationFn: (newFilename: string) =>
      api.images.rename(image!.id, newFilename),
    onSuccess: () => {
      toast.success('Đã đổi tên tệp')
      queryClient.invalidateQueries({ queryKey: ['images', caseId] })
      setIsEditingFilename(false)
    },
    onError: () => {
      toast.error('Lỗi đổi tên tệp')
      setEditedFilename(image?.filename || '')
    },
  })

  // Handle save filename
  const handleSaveFilename = () => {
    const trimmed = editedFilename.trim()
    if (!trimmed || trimmed === image?.filename) {
      setIsEditingFilename(false)
      setEditedFilename(image?.filename || '')
      return
    }
    renameMutation.mutate(trimmed)
  }

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return
      // Skip keyboard shortcuts when editing filename
      if (isEditingFilename) return

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
    [isOpen, selectedDocType, onClose, classifyMutation, isEditingFilename]
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

  const isPending =
    classifyMutation.isPending || retryMutation.isPending || skipMutation.isPending

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal - Near fullscreen like VerificationModal */}
      <div
        className="fixed inset-2 md:inset-4 z-50 flex flex-col bg-card rounded-xl border border-border shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-classify-title"
      >
        {/* Header - Enhanced with gradient like VerificationModal */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-gradient-to-r from-warning/10 via-warning/5 to-transparent flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <FileQuestion className="w-5 h-5 text-warning" />
            </div>
            <div>
              <h2
                id="manual-classify-title"
                className="text-lg font-bold text-foreground"
              >
                Phân loại thủ công
              </h2>
              <p className="text-xs text-muted-foreground">
                AI không thể xác định loại tài liệu
              </p>
            </div>
            <div className="flex items-center gap-2 ml-2">
              <Badge variant="outline" className="text-xs font-medium bg-error-light text-error border-error/30">
                Chưa phân loại
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Open in new tab */}
            {validatedUrl && (
              <a
                href={validatedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-primary hover:bg-primary/10 rounded-lg transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Mở trong tab mới
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted/80 transition-colors"
              aria-label="Đóng"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content - Split view (60/40) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left: Image Viewer using ImageViewer component */}
          <div className="h-1/2 md:h-full md:w-[60%] border-b md:border-b-0 md:border-r border-border bg-muted/20">
            {isUrlLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
              </div>
            ) : urlError || !validatedUrl ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                  <FileQuestion className="w-8 h-8" />
                </div>
                <p className="text-sm font-medium">Không thể tải hình ảnh</p>
              </div>
            ) : (
              <ImageViewer
                imageUrl={validatedUrl}
                isPdf={isPdf}
                className="w-full h-full"
              />
            )}
          </div>

          {/* Right: Classification Form */}
          <div className="h-1/2 md:h-full md:w-[40%] flex flex-col overflow-hidden bg-card">
            {/* Form content area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Filename with edit */}
            <div>
              <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                Tên tệp
                {!isEditingFilename && (
                  <button
                    onClick={() => {
                      setEditedFilename(image.filename)
                      setIsEditingFilename(true)
                    }}
                    className="p-1 rounded hover:bg-muted transition-colors"
                    aria-label="Đổi tên"
                    title="Đổi tên"
                  >
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
              </label>
              {isEditingFilename ? (
                <div className="flex gap-2 mt-1">
                  <input
                    type="text"
                    value={editedFilename}
                    onChange={(e) => setEditedFilename(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveFilename()
                      if (e.key === 'Escape') {
                        setIsEditingFilename(false)
                        setEditedFilename(image.filename)
                      }
                    }}
                    disabled={renameMutation.isPending}
                    className={cn(
                      'flex-1 px-2 py-1 text-sm font-mono',
                      'border border-border rounded bg-background',
                      'focus:outline-none focus:ring-2 focus:ring-primary/20',
                      'disabled:opacity-50'
                    )}
                    autoFocus
                  />
                  <button
                    onClick={handleSaveFilename}
                    disabled={renameMutation.isPending}
                    className="p-1.5 rounded bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                  >
                    {renameMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingFilename(false)
                      setEditedFilename(image.filename)
                    }}
                    disabled={renameMutation.isPending}
                    className="p-1.5 rounded border border-border hover:bg-muted disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <p className="text-sm font-mono text-foreground mt-1 truncate" title={image.filename}>
                  {image.filename}
                </p>
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

            </div>

            {/* Footer - Action Buttons */}
            <div className="px-4 py-3 border-t border-border bg-gradient-to-r from-muted/30 to-transparent">
              {/* Primary: Classify */}
              <button
                onClick={() => {
                  if (selectedDocType) {
                    classifyMutation.mutate(selectedDocType)
                  }
                }}
                disabled={!selectedDocType || isPending}
                className={cn(
                  'w-full flex items-center justify-center gap-2 px-4 py-2.5 h-11',
                  'bg-primary text-white rounded-lg font-semibold',
                  'hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-colors text-sm'
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
              <div className="flex gap-2 mt-2">
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

              {/* Keyboard hint */}
              <p className="text-xs text-muted-foreground text-center mt-3">
                Enter = Phân loại | Esc = Đóng
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
