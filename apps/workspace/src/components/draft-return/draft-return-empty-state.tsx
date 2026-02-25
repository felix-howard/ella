/**
 * Draft Return Empty State - Upload prompt when no draft exists
 * Features drag-drop upload with PDF validation
 */
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, FileText, Loader2 } from 'lucide-react'
import { cn } from '@ella/ui'
import { toast } from '../../stores/toast-store'
import { api } from '../../lib/api-client'

interface DraftReturnEmptyStateProps {
  caseId: string
  clientName: string
  onUploadSuccess: () => void
}

export function DraftReturnEmptyState({ caseId, clientName, onUploadSuccess }: DraftReturnEmptyStateProps) {
  const { t } = useTranslation()
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const handleUpload = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error(t('draftReturn.errorPdfOnly'))
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error(t('draftReturn.errorTooLarge'))
      return
    }

    setIsUploading(true)
    try {
      const result = await api.draftReturns.upload(caseId, file)
      toast.success(t('draftReturn.uploadSuccess'))
      // Copy link to clipboard
      await navigator.clipboard.writeText(result.portalUrl)
      toast.success(t('draftReturn.linkCopied'))
      onUploadSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('draftReturn.uploadError'))
    } finally {
      setIsUploading(false)
    }
  }, [caseId, t, onUploadSuccess])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }, [handleUpload])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    e.target.value = '' // Reset input
  }, [handleUpload])

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="text-center mb-6">
        <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-foreground mb-1">
          {t('draftReturn.emptyTitle')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('draftReturn.emptyDesc', { name: clientName })}
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-border',
          isUploading && 'opacity-50 pointer-events-none'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isUploading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
            <p className="text-sm text-muted-foreground">{t('draftReturn.uploading')}</p>
          </div>
        ) : (
          <>
            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-foreground mb-1">
              {t('draftReturn.dropHere')}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {t('draftReturn.pdfOnly')}
            </p>
            <label className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer">
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileSelect}
                className="sr-only"
              />
              {t('draftReturn.selectFile')}
            </label>
          </>
        )}
      </div>
    </div>
  )
}
