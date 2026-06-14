import { useTranslation } from 'react-i18next'
import { Calendar, FileText, Loader2, Upload } from 'lucide-react'
import { Badge } from '@ella/ui'
import type { StaffFileListItem } from '../../lib/api-client'
import { StaffFileActionMenu } from './staff-file-action-menu'
import { StaffFileInlineRenameInput } from './staff-file-list'
import { StaffFileUploadButton } from './staff-file-upload-button'

export interface StaffInvoiceMonth {
  year: number
  month: number
  active: StaffFileListItem | null
  history: StaffFileListItem[]
  isCurrentMonth: boolean
}

interface StaffInvoiceMonthListProps {
  staffId: string
  months: StaffInvoiceMonth[]
  isLoading: boolean
  canDelete: (file: StaffFileListItem) => boolean
  deletingFileId?: string | null
  onOpen: (file: StaffFileListItem) => void
  onOpenInNewTab: (file: StaffFileListItem) => void
  onDownload: (file: StaffFileListItem) => void
  onRename: (file: StaffFileListItem, title: string) => void
  onStartRename: (file: StaffFileListItem) => void
  onCancelRename: () => void
  onDelete: (file: StaffFileListItem) => void
  renamingFileId?: string | null
  updatingFileId?: string | null
}

function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value))
}

export function StaffInvoiceMonthList({
  staffId,
  months,
  isLoading,
  canDelete,
  deletingFileId,
  onOpen,
  onOpenInNewTab,
  onDownload,
  onRename,
  onStartRename,
  onCancelRename,
  onDelete,
  renamingFileId,
  updatingFileId,
}: StaffInvoiceMonthListProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl bg-card py-12 shadow-sm">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-sm">
      <div className="divide-y divide-border">
        {months.map((item) => {
          const key = `${item.year}-${item.month}`
          const active = item.active
          return (
            <div key={key} className="p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{monthLabel(item.year, item.month)}</p>
                      {item.isCurrentMonth && <Badge variant="accent">{t('profile.staffFiles.currentMonth')}</Badge>}
                    </div>
                    <div className="mt-1 space-y-1 text-sm text-muted-foreground">
                      {active && renamingFileId === active.id ? (
                        <StaffFileInlineRenameInput
                          title={active.title}
                          isPending={updatingFileId === active.id}
                          onSave={(title) => onRename(active, title)}
                          onCancel={onCancelRename}
                        />
                      ) : active ? (
                        <>
                          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                            <button
                              type="button"
                              className="group inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md text-left text-sm font-semibold text-primary outline-none transition-colors hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-primary/30"
                              onClick={() => onOpen(active)}
                              title={active.title}
                            >
                              <FileText className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-y-0.5" />
                              <span className="truncate underline-offset-4 group-hover:underline">{active.title}</span>
                            </button>
                            <span className="text-muted-foreground">
                              {t('profile.staffFiles.uploadedOn', { date: dateLabel(active.createdAt) })}
                            </span>
                          </div>
                        </>
                      ) : (
                        t('profile.staffFiles.noActiveInvoice')
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
                  {!active ? (
                    <StaffFileUploadButton
                      staffId={staffId}
                      kind="INVOICE"
                      invoiceYear={item.year}
                      invoiceMonth={item.month}
                      variant="outline"
                      size="sm"
                    >
                      <Upload className="mr-1.5 h-4 w-4" />
                      {t('profile.staffFiles.addInvoice')}
                    </StaffFileUploadButton>
                  ) : (
                    <StaffFileActionMenu
                      file={active}
                      canDelete={canDelete(active)}
                      isDeleting={deletingFileId === active.id}
                      onOpenInNewTab={onOpenInNewTab}
                      onDownload={onDownload}
                      onRename={onStartRename}
                      onDelete={onDelete}
                    />
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
