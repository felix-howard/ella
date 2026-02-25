/**
 * Document Verification Modal - Modal for verifying document classification
 * Allows staff to verify or reclassify uploaded raw images
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Check,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import { DOC_TYPE_LABELS } from '../../lib/constants'
import { api, type RawImage, type DigitalDoc } from '../../lib/api-client'

// Document types for classification
const COMMON_DOC_TYPES = [
  'W2',
  'SSN_CARD',
  'DRIVER_LICENSE',
  'FORM_1099_INT',
  'FORM_1099_NEC',
  'FORM_1099_DIV',
  'FORM_1099_K',
  'BANK_STATEMENT',
  'BIRTH_CERTIFICATE',
  'DAYCARE_RECEIPT',
  'OTHER',
] as const

type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'reclassify'

export interface DocVerificationModalProps {
  isOpen: boolean
  onClose: () => void
  image: RawImage | null
  digitalDoc?: DigitalDoc | null
  onVerify: (imageId: string, docType: string) => Promise<void>
  onReject: (imageId: string, reason: string) => Promise<void>
  onRequestResend: (imageId: string) => Promise<void>
  /** For navigating between multiple images */
  images?: RawImage[]
  currentIndex?: number
  onNavigate?: (index: number) => void
}

export function DocVerificationModal({
  isOpen,
  onClose,
  image,
  digitalDoc,
  onVerify,
  onReject,
  onRequestResend,
  images = [],
  currentIndex = 0,
  onNavigate,
}: DocVerificationModalProps) {
  const { t } = useTranslation()
  // Initialize selectedDocType from image on mount
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(
    () => (image?.rotation as 0 | 90 | 180 | 270) || 0
  )
  const [status, setStatus] = useState<VerificationStatus>('pending')
  const [selectedDocType, setSelectedDocType] = useState<string>(
    () => image?.checklistItem?.template?.docType || ''
  )
  const [rejectReason, setRejectReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Persist rotation to DB
  const handleRotate = useCallback(() => {
    setRotation((r) => {
      const newRotation = ((r + 90) % 360) as 0 | 90 | 180 | 270
      // Fire-and-forget persist
      if (image?.id) {
        api.images.updateRotation(image.id, newRotation).catch(() => {
          // Silent fail - rotation is non-critical
        })
      }
      return newRotation
    })
  }, [image?.id])

  // Sync state when navigating to a different image
  // This ensures rotation (and other state) is correct when using prev/next navigation
  useEffect(() => {
    if (image?.id) {
      setRotation((image.rotation as 0 | 90 | 180 | 270) || 0)
      setSelectedDocType(image.checklistItem?.template?.docType || '')
      setZoom(1)
      setStatus('pending')
      setRejectReason('')
    }
  }, [image?.id]) // Only trigger when image ID changes (navigation)

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case '+':
        case '=':
          setZoom((z) => Math.min(3, z + 0.25))
          break
        case '-':
          setZoom((z) => Math.max(0.5, z - 0.25))
          break
        case 'r':
        case 'R':
          handleRotate()
          break
        case '0':
          setZoom(1)
          // Reset rotation also persists (but we keep the persisted value, only reset zoom)
          break
        case 'ArrowLeft':
          if (onNavigate && currentIndex > 0) {
            onNavigate(currentIndex - 1)
          }
          break
        case 'ArrowRight':
          if (onNavigate && currentIndex < images.length - 1) {
            onNavigate(currentIndex + 1)
          }
          break
      }
    },
    [isOpen, onClose, onNavigate, currentIndex, images.length, handleRotate]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      containerRef.current?.focus()
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isOpen])

  if (!isOpen || !image) return null

  // TODO: Replace with signed R2 URL in production
  const imageUrl = image.r2Key
    ? `https://placeholder.pics/svg/800x600/DEDEDE/555555/${encodeURIComponent(image.filename.slice(0, 15))}`
    : null

  const isBlurry = image.status === 'BLURRY'
  const suggestedDocType = image.checklistItem?.template?.docType
  const hasNavigation = images.length > 1 && onNavigate

  const handleVerify = async () => {
    if (!selectedDocType) return
    setIsSubmitting(true)
    try {
      await onVerify(image.id, selectedDocType)
      setStatus('verified')
      // Auto-navigate to next if available
      if (hasNavigation && currentIndex < images.length - 1) {
        setTimeout(() => onNavigate!(currentIndex + 1), 500)
      }
    } catch (error) {
      console.error('Verification failed:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) return
    setIsSubmitting(true)
    try {
      await onReject(image.id, rejectReason)
      setStatus('rejected')
    } catch (error) {
      console.error('Rejection failed:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRequestResend = async () => {
    setIsSubmitting(true)
    try {
      await onRequestResend(image.id)
      setStatus('rejected')
    } catch (error) {
      console.error('Resend request failed:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black/90 flex"
      role="dialog"
      aria-modal="true"
      aria-label={t('docVerification.verify', { filename: image.filename })}
      tabIndex={-1}
    >
      {/* Left Panel - Image Viewer */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="text-white">
            <p className="font-medium">{image.filename}</p>
            <p className="text-sm text-white/70">
              {suggestedDocType ? DOC_TYPE_LABELS[suggestedDocType] : t('docVerification.unclassified')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasNavigation && (
              <span className="text-white/50 text-sm mr-4">
                {currentIndex + 1} / {images.length}
              </span>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              aria-label={t('common.close')}
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Image Area */}
        <div className="flex-1 relative overflow-hidden flex items-center justify-center">
          {/* Navigation Arrows */}
          {hasNavigation && (
            <>
              <button
                onClick={() => onNavigate!(currentIndex - 1)}
                disabled={currentIndex === 0}
                className={cn(
                  'absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full',
                  'bg-white/10 hover:bg-white/20 transition-colors',
                  currentIndex === 0 && 'opacity-30 cursor-not-allowed'
                )}
                aria-label={t('docVerification.previousImage')}
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
              <button
                onClick={() => onNavigate!(currentIndex + 1)}
                disabled={currentIndex === images.length - 1}
                className={cn(
                  'absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full',
                  'bg-white/10 hover:bg-white/20 transition-colors',
                  currentIndex === images.length - 1 && 'opacity-30 cursor-not-allowed'
                )}
                aria-label={t('docVerification.nextImage')}
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </button>
            </>
          )}

          {/* Blurry Warning */}
          {isBlurry && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
              <div className="flex items-center gap-2 bg-warning text-warning-foreground px-4 py-2 rounded-full">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">{t('docVerification.blurryWarning')}</span>
              </div>
            </div>
          )}

          {/* Image Display */}
          <div className="max-w-[70%] max-h-[70%]">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={image.filename}
                className="max-w-full max-h-full object-contain transition-transform"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                }}
              />
            ) : (
              <div className="w-96 h-72 bg-muted/20 flex items-center justify-center rounded-xl">
                <ImageIcon className="w-16 h-16 text-white/50" />
              </div>
            )}
          </div>
        </div>

        {/* Image Controls */}
        <div className="flex items-center justify-center gap-2 p-4 border-t border-white/10">
          <button
            onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            aria-label={t('docVerification.zoomOut')}
          >
            <ZoomOut className="w-5 h-5 text-white" />
          </button>
          <span className="text-white text-sm px-3 min-w-[4rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(Math.min(3, zoom + 0.25))}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            aria-label={t('docVerification.zoomIn')}
          >
            <ZoomIn className="w-5 h-5 text-white" />
          </button>
          <div className="w-px h-6 bg-white/20 mx-2" />
          <button
            onClick={handleRotate}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            aria-label={t('docVerification.rotate')}
          >
            <RotateCw className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Right Panel - Verification Actions */}
      <div className="w-96 bg-card border-l border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{t('docVerification.title')}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('docVerification.description')}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Document Type Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('docVerification.docType')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {COMMON_DOC_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedDocType(type)}
                  className={cn(
                    'flex items-center gap-2 p-2.5 rounded-lg border text-sm transition-colors',
                    selectedDocType === type
                      ? 'border-primary bg-primary-light text-primary font-medium'
                      : 'border-border bg-card hover:bg-muted text-foreground'
                  )}
                >
                  <FileText className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{DOC_TYPE_LABELS[type] || type}</span>
                </button>
              ))}
            </div>
          </div>

          {/* OCR Preview if available */}
          {digitalDoc && Object.keys(digitalDoc.extractedData || {}).length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">{t('docVerification.extractedData')}</h3>
              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                {Object.entries(digitalDoc.extractedData).slice(0, 5).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{key}</span>
                    <span className="font-medium text-foreground">{String(value)}</span>
                  </div>
                ))}
                {Object.keys(digitalDoc.extractedData).length > 5 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    {t('docVerification.moreFields', { count: Object.keys(digitalDoc.extractedData).length - 5 })}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Rejection Reason (if needed) */}
          {status === 'pending' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t('docVerification.rejectReasonLabel')}
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t('docVerification.rejectReasonPlaceholder')}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                rows={3}
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-border space-y-3">
          {status === 'verified' ? (
            <div className="flex items-center justify-center gap-2 p-3 bg-success/10 rounded-lg text-success">
              <Check className="w-5 h-5" />
              <span className="font-medium">{t('verification.verified')}</span>
            </div>
          ) : status === 'rejected' ? (
            <div className="flex items-center justify-center gap-2 p-3 bg-error-light rounded-lg text-error">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">{t('docVerification.rejected')}</span>
            </div>
          ) : (
            <>
              {isBlurry ? (
                <button
                  onClick={handleRequestResend}
                  disabled={isSubmitting}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-full',
                    'bg-warning text-warning-foreground font-medium',
                    'hover:bg-warning/90 transition-colors',
                    isSubmitting && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <RefreshCw className={cn('w-5 h-5', isSubmitting && 'animate-spin')} />
                  <span>{t('docVerification.requestResend')}</span>
                </button>
              ) : (
                <button
                  onClick={handleVerify}
                  disabled={!selectedDocType || isSubmitting}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-full',
                    'bg-primary text-white font-medium',
                    'hover:bg-primary-dark transition-colors',
                    (!selectedDocType || isSubmitting) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <Check className="w-5 h-5" />
                  <span>{t('docVerification.confirmContinue')}</span>
                </button>
              )}

              {rejectReason.trim() && (
                <button
                  onClick={handleReject}
                  disabled={isSubmitting}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-full',
                    'bg-error text-white font-medium',
                    'hover:bg-error/90 transition-colors',
                    isSubmitting && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <AlertTriangle className="w-5 h-5" />
                  <span>{t('docVerification.reject')}</span>
                </button>
              )}
            </>
          )}

          {/* Keyboard hints */}
          <p className="text-xs text-muted-foreground text-center">
            {t('docVerification.keyboardHints')}
          </p>
        </div>
      </div>
    </div>
  )
}
