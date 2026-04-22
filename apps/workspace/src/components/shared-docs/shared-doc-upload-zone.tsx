/**
 * SharedDocUploadZone - Reusable PDF drop zone with drag/drop + file picker
 * Validates PDF mime + size (50MB). Calls onFileSelected when valid.
 */
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, Loader2 } from 'lucide-react'
import { cn } from '@ella/ui'
import { toast } from '../../stores/toast-store'

const MAX_FILE_SIZE = 50 * 1024 * 1024

interface SharedDocUploadZoneProps {
  onFileSelected: (file: File) => void
  isUploading?: boolean
  compact?: boolean
  className?: string
}

export function SharedDocUploadZone({
  onFileSelected,
  isUploading = false,
  compact = false,
  className,
}: SharedDocUploadZoneProps) {
  const { t } = useTranslation()
  const [isDragging, setIsDragging] = useState(false)

  const validateAndSelect = useCallback(
    (file: File) => {
      if (file.type !== 'application/pdf') {
        toast.error(t('sharedDocs.errorPdfOnly'))
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(t('sharedDocs.errorTooLarge'))
        return
      }
      onFileSelected(file)
    },
    [onFileSelected, t]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) validateAndSelect(file)
    },
    [validateAndSelect]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) validateAndSelect(file)
      e.target.value = ''
    },
    [validateAndSelect]
  )

  return (
    <div
      className={cn(
        'border-2 border-dashed rounded-lg text-center transition-colors',
        compact ? 'p-4' : 'p-8',
        isDragging ? 'border-primary bg-primary/5' : 'border-border',
        isUploading && 'opacity-50 pointer-events-none',
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isUploading ? (
        <div className="flex flex-col items-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
          <p className="text-sm text-muted-foreground">{t('sharedDocs.uploading')}</p>
        </div>
      ) : (
        <>
          <Upload className={cn('text-muted-foreground mx-auto mb-2', compact ? 'w-6 h-6' : 'w-8 h-8')} />
          <p className="text-sm text-foreground mb-1">{t('sharedDocs.dropHere')}</p>
          {!compact && (
            <p className="text-xs text-muted-foreground mb-4">{t('sharedDocs.pdfOnly')}</p>
          )}
          <label className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer">
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileSelect}
              className="sr-only"
            />
            {t('sharedDocs.selectFile')}
          </label>
        </>
      )}
    </div>
  )
}
