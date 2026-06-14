import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@ella/ui'
import { api, type StaffFileListItem, type StaffInvoiceStatus } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { StaffFileUploadDialog } from './staff-file-upload-dialog'
import { StaffInvoiceMonthList, type StaffInvoiceMonth } from './staff-invoice-month-list'

interface StaffInvoicesTabProps {
  staffId: string
  canManageInvoiceStatus: boolean
  isOwnProfile: boolean
}

interface UploadTarget {
  year: number
  month: number
  replacingExisting: boolean
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

function canUploadForSlot(month: StaffInvoiceMonth): boolean {
  return !month.active || month.active.invoiceStatus !== 'PAID'
}

export function StaffInvoicesTab({
  staffId,
  canManageInvoiceStatus,
  isOwnProfile,
}: StaffInvoicesTabProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [uploadTarget, setUploadTarget] = useState<UploadTarget | null>(null)
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)
  const [updatingFileId, setUpdatingFileId] = useState<string | null>(null)
  const currentDate = new Date()
  const defaultUploadMonth = selectedYear === currentDate.getFullYear()
    ? currentDate.getMonth() + 1
    : 1

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
      invalidateInvoices()
    },
    onError: (error: Error) => toast.error(error.message || t('profile.staffFiles.deleteFailed')),
    onSettled: () => setDeletingFileId(null),
  })

  const statusMutation = useMutation({
    mutationFn: ({ file, status }: { file: StaffFileListItem; status: StaffInvoiceStatus }) =>
      api.team.updateStaffInvoiceStatus(staffId, file.id, { status }),
    onMutate: ({ file }) => setUpdatingFileId(file.id),
    onSuccess: () => {
      toast.success(t('profile.staffFiles.statusUpdated'))
      invalidateInvoices()
    },
    onError: (error: Error) => toast.error(error.message || t('profile.staffFiles.statusUpdateFailed')),
    onSettled: () => setUpdatingFileId(null),
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

  const currentMonth = months.find((month) => month.isCurrentMonth)
  const defaultUploadSlot =
    months.find((month) => month.month === defaultUploadMonth && canUploadForSlot(month)) ??
    months.find(canUploadForSlot)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t('profile.tabs.invoices')}</h2>
          <p className="text-sm text-muted-foreground">
            {currentMonth?.active
              ? t('profile.staffFiles.currentMonthStatus', {
                  status: t(`profile.staffFiles.${currentMonth.active.invoiceStatus?.toLowerCase() ?? 'submitted'}`),
                })
              : t('profile.staffFiles.invoiceEmptyDesc')}
          </p>
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
          <Button
            disabled={!defaultUploadSlot}
            onClick={() => {
              if (!defaultUploadSlot) return
              setUploadTarget({
                year: selectedYear,
                month: defaultUploadSlot.month,
                replacingExisting: Boolean(defaultUploadSlot.active),
              })
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('profile.staffFiles.addInvoice')}
          </Button>
        </div>
      </div>

      {filesQuery.isError ? (
        <div className="rounded-xl bg-card p-6 text-sm text-destructive shadow-sm">
          {t('profile.staffFiles.loadFailed')}
        </div>
      ) : (
        <StaffInvoiceMonthList
          months={months}
          isLoading={filesQuery.isLoading}
          canManageInvoiceStatus={canManageInvoiceStatus}
          canDelete={(file) => !isOwnProfile || file.invoiceStatus !== 'PAID'}
          deletingFileId={deletingFileId}
          updatingFileId={updatingFileId}
          onUpload={(year, month, replacingExisting) => setUploadTarget({ year, month, replacingExisting })}
          onDownload={handleDownload}
          onDelete={handleDelete}
          onStatusChange={(file, status) => statusMutation.mutate({ file, status })}
        />
      )}

      {uploadTarget && (
        <StaffFileUploadDialog
          open
          onClose={() => setUploadTarget(null)}
          staffId={staffId}
          kind="INVOICE"
          defaultYear={uploadTarget.year}
          defaultMonth={uploadTarget.month}
          replacingExisting={uploadTarget.replacingExisting}
        />
      )}
    </div>
  )
}
