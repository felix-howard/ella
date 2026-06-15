import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { api, type StaffFileListItem } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { UploadLinkConfirmModal } from '../upload-links/upload-link-confirm-modal'
import { StaffFileList } from './staff-file-list'
import { StaffFileUploadButton } from './staff-file-upload-button'
import { StaffFileViewer } from './staff-file-viewer'

interface StaffDocumentsTabProps {
  staffId: string
}

export function StaffDocumentsTab({ staffId }: StaffDocumentsTabProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)
  const [updatingFileId, setUpdatingFileId] = useState<string | null>(null)
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null)
  const [fileToDelete, setFileToDelete] = useState<StaffFileListItem | null>(null)
  const [viewingFile, setViewingFile] = useState<StaffFileListItem | null>(null)

  const filesQuery = useQuery({
    queryKey: ['staff-files', staffId, 'PERSONAL_DOCUMENT'],
    queryFn: () => api.team.getStaffFiles(staffId, { kind: 'PERSONAL_DOCUMENT' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => api.team.deleteStaffFile(staffId, fileId),
    onMutate: (fileId) => setDeletingFileId(fileId),
    onSuccess: () => {
      toast.success(t('profile.staffFiles.deleteSuccess'))
      setFileToDelete(null)
      queryClient.invalidateQueries({ queryKey: ['staff-files', staffId, 'PERSONAL_DOCUMENT'] })
    },
    onError: (error: Error) => toast.error(error.message || t('profile.staffFiles.deleteFailed')),
    onSettled: () => setDeletingFileId(null),
  })

  const updateMutation = useMutation({
    mutationFn: ({ file, title }: { file: StaffFileListItem; title: string }) =>
      api.team.updateStaffFile(staffId, file.id, { title }),
    onMutate: ({ file }) => setUpdatingFileId(file.id),
    onSuccess: () => {
      toast.success(t('classify.fileRenamed'))
      setRenamingFileId(null)
      queryClient.invalidateQueries({ queryKey: ['staff-files', staffId, 'PERSONAL_DOCUMENT'] })
    },
    onError: (error: Error) => toast.error(error.message || t('profile.staffFiles.uploadFailed')),
    onSettled: () => setUpdatingFileId(null),
  })

  const getDownloadUrl = async (file: StaffFileListItem) => {
    const { downloadUrl } = await api.team.getStaffFileDownloadUrl(staffId, file.id)
    return downloadUrl
  }

  const handleOpenInNewTab = async (file: StaffFileListItem) => {
    try {
      window.open(await getDownloadUrl(file), '_blank', 'noopener,noreferrer')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('profile.staffFiles.downloadFailed'))
    }
  }

  const handleDownload = async (file: StaffFileListItem) => {
    try {
      const blob = await api.team.downloadStaffFile(staffId, file.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = file.originalFilename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('profile.staffFiles.downloadFailed'))
    }
  }

  const handleRename = (file: StaffFileListItem, title: string) => {
    updateMutation.mutate({ file, title })
  }

  const handleDelete = (file: StaffFileListItem) => {
    setFileToDelete(file)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t('profile.tabs.documents')}</h2>
          <p className="text-sm text-muted-foreground">{t('profile.staffFiles.documentsSummary')}</p>
        </div>
        <StaffFileUploadButton staffId={staffId} kind="PERSONAL_DOCUMENT">
          <Plus className="mr-2 h-4 w-4" />
          {t('profile.staffFiles.addDocument')}
        </StaffFileUploadButton>
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
          onOpen={setViewingFile}
          onOpenInNewTab={handleOpenInNewTab}
          onDownload={handleDownload}
          onRename={handleRename}
          onStartRename={(file) => setRenamingFileId(file.id)}
          onCancelRename={() => setRenamingFileId(null)}
          onDelete={handleDelete}
          canDelete={() => true}
          renamingFileId={renamingFileId}
          updatingFileId={updatingFileId}
          deletingFileId={deletingFileId}
        />
      )}

      <UploadLinkConfirmModal
        open={Boolean(fileToDelete)}
        title={t('fileActions.deleteConfirmTitle')}
        description={t('fileActions.deleteConfirmMessage', { filename: fileToDelete?.title ?? '' })}
        confirmLabel={t('profile.staffFiles.delete')}
        variant="destructive"
        isPending={deleteMutation.isPending}
        onCancel={() => {
          if (!deleteMutation.isPending) setFileToDelete(null)
        }}
        onConfirm={() => fileToDelete && deleteMutation.mutate(fileToDelete.id)}
      />

      <StaffFileViewer staffId={staffId} file={viewingFile} onClose={() => setViewingFile(null)} />
    </div>
  )
}
