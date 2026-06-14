import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { StaffFileListItem } from '../../lib/api-client'
import { api } from '../../lib/api-client'
import { FileViewerModal } from '../file-viewer'

interface StaffFileViewerProps {
  staffId: string
  file: StaffFileListItem | null
  onClose: () => void
}

export function StaffFileViewer({ staffId, file, onClose }: StaffFileViewerProps) {
  const { t } = useTranslation()
  const fileId = file?.id
  const extension = file?.originalFilename.split('.').pop()
  const titleHasExtension = /\.[a-z0-9]+$/i.test(file?.title ?? '')
  const viewerFilename = file
    ? titleHasExtension || !extension
      ? file.title
      : `${file.title}.${extension}`
    : ''
  const urlQuery = useQuery({
    queryKey: ['staff-file-view-url', staffId, fileId],
    queryFn: () => api.team.getStaffFileDownloadUrl(staffId, fileId!),
    enabled: Boolean(fileId),
  })

  return (
    <FileViewerModal
      url={urlQuery.data?.downloadUrl ?? null}
      filename={viewerFilename}
      isOpen={Boolean(file)}
      onClose={onClose}
      isLoading={urlQuery.isLoading}
      error={urlQuery.isError ? t('profile.staffFiles.downloadFailed') : null}
    />
  )
}
