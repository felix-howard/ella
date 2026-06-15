import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@ella/ui'
import { api, type StaffFileListItem } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { UploadLinkConfirmModal } from '../upload-links/upload-link-confirm-modal'
import { StaffInvoiceMonthList, type StaffInvoiceMonth } from './staff-invoice-month-list'
import { StaffFileViewer } from './staff-file-viewer'

interface StaffInvoicesTabProps {
  staffId: string
  isOwnProfile: boolean
}

function buildInvoiceMonths(files: StaffFileListItem[], year: number): StaffInvoiceMonth[] {
  const current = new Date()
  return Array.from({ length: 12 }, (_, index) => {
    const month = 12 - index
    const monthFiles = files.filter((file) => file.invoiceYear === year && file.invoiceMonth === month)
    const active = monthFiles.find((file) => file.isActive) ?? null
    return {
      year,
      month,
      active,
      history: monthFiles.filter((file) => file.id !== active?.id),
      isCurrentMonth: current.getFullYear() === year && current.getMonth() + 1 === month,
    }
  })
}

export function StaffInvoicesTab({
  staffId,
  isOwnProfile,
}: StaffInvoicesTabProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)
  const [updatingFileId, setUpdatingFileId] = useState<string | null>(null)
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null)
  const [fileToDelete, setFileToDelete] = useState<StaffFileListItem | null>(null)
  const [viewingFile, setViewingFile] = useState<StaffFileListItem | null>(null)
  const filesQuery = useQuery({
    queryKey: ['staff-files', staffId, 'INVOICE', selectedYear],
    queryFn: () => api.team.getStaffFiles(staffId, { kind: 'INVOICE', year: selectedYear }),
  })

  const months = useMemo(
    () => buildInvoiceMonths(filesQuery.data?.data ?? [], selectedYear),
    [filesQuery.data?.data, selectedYear]
  )

  const invalidateInvoices = () => {
    queryClient.invalidateQueries({ queryKey: ['staff-files', staffId, 'INVOICE'] })
  }

  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => api.team.deleteStaffFile(staffId, fileId),
    onMutate: (fileId) => setDeletingFileId(fileId),
    onSuccess: () => {
      toast.success(t('profile.staffFiles.deleteSuccess'))
      setFileToDelete(null)
      invalidateInvoices()
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
      invalidateInvoices()
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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t('profile.tabs.invoices')}</h2>
          <p className="text-sm text-muted-foreground">{t('profile.staffFiles.invoiceEmptyDesc')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSelectedYear((year) => year - 1)}>
            <ChevronLeft className="h-4 w-4" />
            {selectedYear - 1}
          </Button>
          <span className="min-w-16 text-center text-sm font-medium text-foreground">{selectedYear}</span>
          <Button variant="outline" size="sm" onClick={() => setSelectedYear((year) => year + 1)}>
            {selectedYear + 1}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {filesQuery.isError ? (
        <div className="rounded-xl bg-card p-6 text-sm text-destructive shadow-sm">
          {t('profile.staffFiles.loadFailed')}
        </div>
      ) : (
        <StaffInvoiceMonthList
          staffId={staffId}
          months={months}
          isLoading={filesQuery.isLoading}
          canDelete={(file) => !isOwnProfile || file.invoiceStatus !== 'PAID'}
          deletingFileId={deletingFileId}
          onOpen={setViewingFile}
          onOpenInNewTab={handleOpenInNewTab}
          onDownload={handleDownload}
          onRename={handleRename}
          onStartRename={(file) => setRenamingFileId(file.id)}
          onCancelRename={() => setRenamingFileId(null)}
          onDelete={handleDelete}
          renamingFileId={renamingFileId}
          updatingFileId={updatingFileId}
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
