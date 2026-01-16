/**
 * Manual Classification Modal - Manually classify unclassified documents
 * Opens for UPLOADED/UNCLASSIFIED images when AI failed or needs manual intervention
 * Features: Embedded PDF/image viewer with zoom, document type dropdown, rename, retry AI
 */

import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
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
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Pencil,
} from 'lucide-react'
import { cn } from '@ella/ui'
import { DOC_TYPE_LABELS } from '../../lib/constants'
import { api, type RawImage } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { useSignedUrl } from '../../hooks/use-signed-url'

// Lazy load PDF viewer component
const PdfViewer = lazy(() => import('../ui/pdf-viewer'))

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

// Zoom constants
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25

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

  // Viewer state
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [numPages, setNumPages] = useState<number | null>(null)

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
    setImageError(false)
    // Reset viewer state
    setZoom(1)
    setRotation(0)
    setCurrentPage(1)
    setNumPages(null)
    // Reset filename editing
    setIsEditingFilename(false)
    setEditedFilename(image?.filename || '')
  }, [image])
  /* eslint-enable react-hooks/set-state-in-effect */

  // PDF load handlers
  const handlePdfLoadSuccess = useCallback((pages: number) => {
    setNumPages(pages)
  }, [])

  const handlePdfLoadError = useCallback(() => {
    setImageError(true)
  }, [])

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

      {/* Modal - Expanded size for better viewing */}
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-5xl bg-card rounded-xl border border-border shadow-xl max-h-[95vh] overflow-hidden flex flex-col"
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
        <div className="p-4 overflow-hidden flex-1 flex gap-4">
          {/* Left: File Viewer with controls */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Viewer Controls */}
            <div className="flex items-center justify-between mb-2 px-1">
              {/* Zoom & Rotate controls */}
              <div className="flex items-center gap-1 bg-muted rounded-full px-2 py-1">
                <button
                  onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
                  className="p-1.5 rounded-full hover:bg-background transition-colors"
                  aria-label="Thu nhỏ"
                  title="Thu nhỏ"
                >
                  <ZoomOut className="w-4 h-4 text-foreground" />
                </button>
                <span className="text-xs text-foreground min-w-[3rem] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
                  className="p-1.5 rounded-full hover:bg-background transition-colors"
                  aria-label="Phóng to"
                  title="Phóng to"
                >
                  <ZoomIn className="w-4 h-4 text-foreground" />
                </button>
                <div className="w-px h-4 bg-border mx-1" />
                <button
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1.5 rounded-full hover:bg-background transition-colors"
                  aria-label="Xoay"
                  title="Xoay"
                >
                  <RotateCw className="w-4 h-4 text-foreground" />
                </button>
              </div>

              {/* Open in new tab */}
              {validatedUrl && (
                <a
                  href={validatedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Mở trong tab mới
                </a>
              )}
            </div>

            {/* Main Viewer Area */}
            <div className="flex-1 bg-muted rounded-lg overflow-auto relative">
              {showLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-muted-foreground animate-spin" />
                </div>
              )}
              {showError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-destructive">
                  <AlertCircle className="w-12 h-12" />
                  <span className="text-sm">Không thể tải tệp</span>
                </div>
              )}
              {showImage && (
                <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                  <img
                    src={validatedUrl}
                    alt={image.filename}
                    className="max-w-full max-h-full object-contain transition-transform duration-200"
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    }}
                    onError={() => setImageError(true)}
                    draggable={false}
                  />
                </div>
              )}
              {showPdf && (
                <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                  <Suspense
                    fallback={
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                      </div>
                    }
                  >
                    <PdfViewer
                      fileUrl={validatedUrl}
                      zoom={zoom}
                      rotation={rotation}
                      currentPage={currentPage}
                      onLoadSuccess={handlePdfLoadSuccess}
                      onLoadError={handlePdfLoadError}
                    />
                  </Suspense>
                </div>
              )}
              {showPlaceholder && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  {isPdf ? (
                    <FileText className="w-16 h-16 text-muted-foreground" />
                  ) : (
                    <ImageIcon className="w-16 h-16 text-muted-foreground" />
                  )}
                  <span className="text-sm text-muted-foreground">
                    Không có bản xem trước
                  </span>
                </div>
              )}
            </div>

            {/* PDF Page Navigation */}
            {isPdf && numPages && numPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-2 bg-muted rounded-full px-3 py-1.5 mx-auto">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1 rounded-full hover:bg-background transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Trang trước"
                >
                  <ChevronLeft className="w-4 h-4 text-foreground" />
                </button>
                <span className="text-xs text-foreground min-w-[4rem] text-center">
                  {currentPage} / {numPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                  disabled={currentPage >= numPages}
                  className="p-1 rounded-full hover:bg-background transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Trang sau"
                >
                  <ChevronRight className="w-4 h-4 text-foreground" />
                </button>
              </div>
            )}
          </div>

          {/* Right: Classification Form */}
          <div className="w-80 flex-shrink-0 space-y-4 overflow-y-auto">
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
    </>
  )
}
