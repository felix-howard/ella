/**
 * Client Avatar Uploader - Click to upload avatar with compression
 * Reuses pattern from Staff avatar uploader
 */
import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Camera, Loader2, Check, AlertCircle, Trash2, X } from 'lucide-react'
import { cn } from '@ella/ui'
import { api } from '../../../lib/api-client'
import { compressImage, isValidImageFile } from '../../../lib/image-utils'
import { toast } from '../../../stores/toast-store'
import { getInitials, getAvatarColor } from '../../../lib/formatters'

interface ClientAvatarUploaderProps {
  clientId: string
  currentAvatarUrl: string | null
  name: string
  size?: 'sm' | 'md' | 'lg'
  canEdit?: boolean
}

type UploadState = 'idle' | 'compressing' | 'uploading' | 'confirming' | 'success' | 'error'

const sizeClasses = {
  sm: 'w-12 h-12 text-base',
  md: 'w-16 h-16 text-xl',
  lg: 'w-24 h-24 text-3xl',
}

export function ClientAvatarUploader({
  clientId,
  currentAvatarUrl,
  name,
  size = 'lg',
  canEdit = true,
}: ClientAvatarUploaderProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const avatarColor = getAvatarColor(name)

  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Get presigned URL
  const presignedUrlMutation = useMutation({
    mutationFn: (data: { contentType: string; fileSize: number }) =>
      api.clients.getAvatarPresignedUrl(clientId, data),
  })

  // Confirm upload
  const confirmMutation = useMutation({
    mutationFn: (r2Key: string) => api.clients.confirmAvatarUpload(clientId, r2Key),
    onSuccess: () => {
      setUploadState('success')
      toast.success(t('clientOverview.avatarUpdated'))
      queryClient.invalidateQueries({ queryKey: ['client', clientId] })
      setTimeout(() => {
        setUploadState('idle')
        setPreviewUrl(null)
      }, 1500)
    },
    onError: () => {
      setUploadState('error')
      setError(t('clientOverview.avatarUploadFailed'))
    },
  })

  // Delete avatar
  const deleteMutation = useMutation({
    mutationFn: () => api.clients.deleteAvatar(clientId),
    onSuccess: () => {
      toast.success(t('clientOverview.avatarRemoved'))
      queryClient.invalidateQueries({ queryKey: ['client', clientId] })
    },
    onError: () => {
      toast.error(t('clientOverview.avatarDeleteFailed'))
    },
  })

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setPreviewUrl(null)

    if (!isValidImageFile(file)) {
      setError(t('clientOverview.invalidImageType'))
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError(t('clientOverview.imageTooLarge'))
      return
    }

    try {
      setUploadState('compressing')
      const { blob, dataUrl } = await compressImage(file)
      setPreviewUrl(dataUrl)

      setUploadState('uploading')
      const { uploadUrl, r2Key } = await presignedUrlMutation.mutateAsync({
        contentType: 'image/jpeg',
        fileSize: blob.size,
      })

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': 'image/jpeg' },
      })

      if (!uploadResponse.ok) throw new Error('Upload failed')

      setUploadState('confirming')
      await confirmMutation.mutateAsync(r2Key)
    } catch (err) {
      console.error('Avatar upload error:', err)
      setUploadState('error')
      setError(t('clientOverview.avatarUploadFailed'))
    }
  }

  const handleClick = () => {
    if (canEdit && uploadState === 'idle') {
      fileInputRef.current?.click()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && canEdit && uploadState === 'idle') {
      e.preventDefault()
      fileInputRef.current?.click()
    }
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (currentAvatarUrl && !deleteMutation.isPending) {
      deleteMutation.mutate()
    }
  }

  const handleClearError = () => {
    setUploadState('idle')
    setPreviewUrl(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const isUploading = ['compressing', 'uploading', 'confirming'].includes(uploadState)
  const displayUrl = previewUrl || currentAvatarUrl

  return (
    <div className="relative inline-block">
      {/* Avatar Display */}
      <div
        role={canEdit ? 'button' : undefined}
        tabIndex={canEdit && uploadState === 'idle' ? 0 : undefined}
        aria-label={canEdit ? t('clientOverview.changeAvatar') : undefined}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative rounded-full overflow-hidden flex-shrink-0',
          sizeClasses[size],
          canEdit && uploadState === 'idle' && 'cursor-pointer group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
        )}
      >
        {displayUrl ? (
          <img src={displayUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className={cn('w-full h-full flex items-center justify-center', avatarColor.bg, avatarColor.text)}>
            <span className="font-semibold">{getInitials(name)}</span>
          </div>
        )}

        {/* Edit overlay */}
        {canEdit && uploadState === 'idle' && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="w-6 h-6 text-white" />
          </div>
        )}

        {/* Upload progress overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        )}

        {/* Success overlay */}
        {uploadState === 'success' && (
          <div className="absolute inset-0 bg-emerald-500/50 flex items-center justify-center">
            <Check className="w-6 h-6 text-white" />
          </div>
        )}
      </div>

      {/* Delete button (shows when avatar exists) */}
      {canEdit && currentAvatarUrl && uploadState === 'idle' && (
        <button
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-destructive text-white hover:bg-destructive/90 transition-colors shadow-sm"
          aria-label={t('clientOverview.removeAvatar')}
        >
          {deleteMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Trash2 className="w-3 h-3" />
          )}
        </button>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={!canEdit || isUploading}
      />

      {/* Error message with close button */}
      {error && (
        <div className="absolute top-full left-0 mt-2 flex items-center gap-1.5 text-sm text-destructive whitespace-nowrap">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
          <button
            onClick={handleClearError}
            className="ml-1 p-0.5 rounded hover:bg-destructive/10 transition-colors"
            aria-label={t('common.close')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Upload status text with aria-live for accessibility */}
      {isUploading && (
        <p
          className="absolute top-full left-0 mt-2 text-xs text-muted-foreground whitespace-nowrap"
          aria-live="polite"
        >
          {uploadState === 'compressing' && t('clientOverview.compressing')}
          {uploadState === 'uploading' && t('clientOverview.uploading')}
          {uploadState === 'confirming' && t('clientOverview.saving')}
        </p>
      )}
    </div>
  )
}
