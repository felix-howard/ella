/**
 * Avatar Uploader - File selection, compression, and upload to R2
 * Shows preview during upload with progress indication
 */
import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Camera, Loader2, Check, AlertCircle } from 'lucide-react'
import { cn } from '@ella/ui'
import { api } from '../../lib/api-client'
import { compressImage, isValidImageFile } from '../../lib/image-utils'
import { toast } from '../../stores/toast-store'
import { getInitials, getAvatarColor } from '../../lib/formatters'

interface AvatarUploaderProps {
  staffId: string
  currentAvatarUrl: string | null
  name: string
  canEdit: boolean
}

type UploadState = 'idle' | 'compressing' | 'uploading' | 'confirming' | 'success' | 'error'

export function AvatarUploader({ staffId, currentAvatarUrl, name, canEdit }: AvatarUploaderProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const avatarColor = getAvatarColor(name)

  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Get presigned URL
  const presignedUrlMutation = useMutation({
    mutationFn: (data: { contentType: 'image/jpeg'; fileSize: number }) =>
      api.team.getAvatarPresignedUrl(staffId, data),
  })

  // Confirm upload
  const confirmMutation = useMutation({
    mutationFn: (r2Key: string) => api.team.confirmAvatarUpload(staffId, r2Key),
    onSuccess: () => {
      setUploadState('success')
      toast.success(t('profile.avatarUpdated'))
      queryClient.invalidateQueries({ queryKey: ['team-member-profile', staffId] })
      queryClient.invalidateQueries({ queryKey: ['staff-me'] })
      // Reset after success
      setTimeout(() => {
        setUploadState('idle')
        setPreviewUrl(null)
      }, 1500)
    },
    onError: () => {
      setUploadState('error')
      setError(t('profile.avatarUploadFailed'))
    },
  })

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset state
    setError(null)
    setPreviewUrl(null)

    // Validate
    if (!isValidImageFile(file)) {
      setError(t('profile.invalidImageType'))
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError(t('profile.imageTooLarge'))
      return
    }

    try {
      // Compress
      setUploadState('compressing')
      const { blob, dataUrl } = await compressImage(file)
      setPreviewUrl(dataUrl)

      // Get presigned URL
      setUploadState('uploading')
      const { presignedUrl, key } = await presignedUrlMutation.mutateAsync({
        contentType: 'image/jpeg',
        fileSize: blob.size,
      })

      // Upload to R2
      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': 'image/jpeg',
        },
      })

      if (!uploadResponse.ok) {
        throw new Error('Upload failed')
      }

      // Confirm
      setUploadState('confirming')
      await confirmMutation.mutateAsync(key)
    } catch (err) {
      console.error('Avatar upload error:', err)
      setUploadState('error')
      setError(t('profile.avatarUploadFailed'))
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

  const handleCancel = () => {
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
    <div className="relative">
      {/* Avatar Display */}
      <div
        role={canEdit ? 'button' : undefined}
        tabIndex={canEdit && uploadState === 'idle' ? 0 : undefined}
        aria-label={canEdit ? t('profile.changeAvatar') : undefined}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative w-20 h-20 rounded-full overflow-hidden',
          canEdit && uploadState === 'idle' && 'cursor-pointer group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
        )}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={cn('w-full h-full flex items-center justify-center', avatarColor.bg, avatarColor.text)}>
            <span className="text-2xl font-semibold">{getInitials(name)}</span>
          </div>
        )}

        {/* Overlay for edit */}
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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={!canEdit || isUploading}
      />

      {/* Error message */}
      {error && (
        <div className="absolute top-full left-0 mt-2 flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
          <button
            onClick={handleCancel}
            className="ml-2 text-xs underline hover:no-underline"
          >
            {t('common.close')}
          </button>
        </div>
      )}

      {/* Upload status text */}
      {isUploading && (
        <p className="absolute top-full left-0 mt-2 text-xs text-muted-foreground">
          {uploadState === 'compressing' && t('profile.compressing')}
          {uploadState === 'uploading' && t('profile.uploading')}
          {uploadState === 'confirming' && t('profile.saving')}
        </p>
      )}
    </div>
  )
}
