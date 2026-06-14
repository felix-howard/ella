import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Button } from '@ella/ui'
import { api, type StaffFileListItem } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { StaffFileList } from './staff-file-list'
import { StaffFileUploadDialog } from './staff-file-upload-dialog'

interface StaffDocumentsTabProps {
  staffId: string
}

export function StaffDocumentsTab({ staffId }: StaffDocumentsTabProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)

  const filesQuery = useQuery({
    queryKey: ['staff-files', staffId, 'PERSONAL_DOCUMENT'],
    queryFn: () => api.team.getStaffFiles(staffId, { kind: 'PERSONAL_DOCUMENT' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => api.team.deleteStaffFile(staffId, fileId),
    onMutate: (fileId) => setDeletingFileId(fileId),
    onSuccess: () => {
      toast.success(t('profile.staffFiles.deleteSuccess'))
      queryClient.invalidateQueries({ queryKey: ['staff-files', staffId, 'PERSONAL_DOCUMENT'] })
    },
    onError: (error: Error) => toast.error(error.message || t('profile.staffFiles.deleteFailed')),
    onSettled: () => setDeletingFileId(null),
  })

  const handleDownload = async (file: StaffFileListItem) => {
    try {
      const { downloadUrl } = await api.team.getStaffFileDownloadUrl(staffId, file.id)
      window.open(downloadUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('profile.staffFiles.downloadFailed'))
    }
  }

  const handleDelete = (file: StaffFileListItem) => {
    if (!confirm(t('profile.staffFiles.deleteConfirm', { title: file.title }))) return
    deleteMutation.mutate(file.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t('profile.tabs.documents')}</h2>
          <p className="text-sm text-muted-foreground">{t('profile.staffFiles.documentsSummary')}</p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('profile.staffFiles.addDocument')}
        </Button>
      </div>

      {filesQuery.isError ? (
        <div className="rounded-xl bg-card p-6 text-sm text-destructive shadow-sm">
          {t('profile.staffFiles.loadFailed')}
        </div>
      ) : (
        <StaffFileList
          files={filesQuery.data?.data ?? []}
          isLoading={filesQuery.isLoading}
          emptyTitle={t('profile.staffFiles.documentEmpty')}
          emptyDescription={t('profile.staffFiles.documentEmptyDesc')}
          onDownload={handleDownload}
          onDelete={handleDelete}
          canDelete={() => true}
          deletingFileId={deletingFileId}
        />
      )}

      <StaffFileUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        staffId={staffId}
        kind="PERSONAL_DOCUMENT"
      />
    </div>
  )
}
