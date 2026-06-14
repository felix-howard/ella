import { useCallback, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api, type StaffFileKind, type StaffFileListItem } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { putFileWithProgress, validateStaffFileUploadDraft } from './staff-file-upload-utils'

type StaffFileUploadState = 'idle' | 'presigning' | 'uploading' | 'confirming' | 'success' | 'error'

interface StaffFileUploadInput {
  file: File
  title?: string
  category?: string
  invoiceYear?: number
  invoiceMonth?: number
}

interface UseStaffFileUploadOptions {
  staffId: string
  kind: StaffFileKind
  onSuccess?: (file: StaffFileListItem) => void
  notifyOnError?: boolean
}

interface UseStaffFileUploadResult {
  upload: (input: StaffFileUploadInput) => Promise<StaffFileListItem | null>
  reset: () => void
  status: StaffFileUploadState
  progress: number
  error: string | null
  isUploading: boolean
}

export function useStaffFileUpload({
  staffId,
  kind,
  onSuccess,
  notifyOnError = false,
}: UseStaffFileUploadOptions): UseStaffFileUploadResult {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<StaffFileUploadState>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setProgress(0)
    setError(null)
  }, [])

  const upload = useCallback(
    async (input: StaffFileUploadInput) => {
      setError(null)
      setProgress(0)

      const validated = validateStaffFileUploadDraft({ ...input, kind })
      if (!validated.ok) {
        const message = t(validated.messageKey)
        setStatus('error')
        setError(message)
        if (notifyOnError) toast.error(message)
        return null
      }

      try {
        setStatus('presigning')
        const metadata = {
          kind,
          contentType: validated.contentType,
          fileSize: input.file.size,
          originalFilename: input.file.name,
          invoiceYear: input.invoiceYear,
          invoiceMonth: input.invoiceMonth,
        }
        const { uploadUrl, uploadKey } = await api.team.getStaffFileUploadUrl(staffId, metadata)

        setStatus('uploading')
        await putFileWithProgress(uploadUrl, input.file, validated.contentType, setProgress)

        setStatus('confirming')
        const response = await api.team.confirmStaffFileUpload(staffId, {
          ...metadata,
          uploadKey,
          title: validated.title,
          category: validated.category,
        })

        setStatus('success')
        toast.success(t('profile.staffFiles.uploadSuccess'))
        queryClient.invalidateQueries({ queryKey: ['team-member-profile', staffId] })
        queryClient.invalidateQueries({ queryKey: ['staff-files', staffId, kind] })
        onSuccess?.(response.file)
        return response.file
      } catch (err) {
        console.error('Staff file upload error:', err)
        const message = t('profile.staffFiles.uploadFailed')
        setStatus('error')
        setError(message)
        if (notifyOnError) toast.error(message)
        return null
      }
    },
    [kind, notifyOnError, onSuccess, queryClient, staffId, t]
  )

  const isUploading = useMemo(
    () => status === 'presigning' || status === 'uploading' || status === 'confirming',
    [status]
  )

  return { upload, reset, status, progress, error, isUploading }
}
