import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar, CheckCircle, DollarSign, Download, History, Loader2, Trash2, Upload, XCircle } from 'lucide-react'
import { Badge, Button, cn } from '@ella/ui'
import type { StaffFileListItem, StaffInvoiceStatus } from '../../lib/api-client'

export interface StaffInvoiceMonth {
  year: number
  month: number
  active: StaffFileListItem | null
  history: StaffFileListItem[]
  isCurrentMonth: boolean
}

interface StaffInvoiceMonthListProps {
  months: StaffInvoiceMonth[]
  isLoading: boolean
  canManageInvoiceStatus: boolean
  canDelete: (file: StaffFileListItem) => boolean
  deletingFileId?: string | null
  updatingFileId?: string | null
  onUpload: (year: number, month: number, replacingExisting: boolean) => void
  onDownload: (file: StaffFileListItem) => void
  onDelete: (file: StaffFileListItem) => void
  onStatusChange: (file: StaffFileListItem, status: StaffInvoiceStatus) => void
}

const statusVariant: Record<StaffInvoiceStatus, 'secondary' | 'success' | 'warning' | 'error'> = {
  SUBMITTED: 'secondary',
  APPROVED: 'warning',
  PAID: 'success',
  REJECTED: 'error',
}

function statusLabel(status: StaffInvoiceStatus | null, t: (key: string) => string): string {
  if (status === 'APPROVED') return t('profile.staffFiles.approved')
  if (status === 'PAID') return t('profile.staffFiles.paid')
  if (status === 'REJECTED') return t('profile.staffFiles.rejected')
  return t('profile.staffFiles.submitted')
}

function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value))
}

function nextStatuses(status: StaffInvoiceStatus | null): StaffInvoiceStatus[] {
  if (status === 'SUBMITTED') return ['APPROVED', 'PAID', 'REJECTED']
  if (status === 'APPROVED') return ['PAID', 'REJECTED']
  return []
}

export function StaffInvoiceMonthList({
  months,
  isLoading,
  canManageInvoiceStatus,
  canDelete,
  deletingFileId,
  updatingFileId,
  onUpload,
  onDownload,
  onDelete,
  onStatusChange,
}: StaffInvoiceMonthListProps) {
  const { t } = useTranslation()
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set())

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
          const expanded = expandedMonths.has(key)
          const canUploadForMonth = !active || active.invoiceStatus !== 'PAID'
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
                      {active?.invoiceStatus && (
                        <Badge variant={statusVariant[active.invoiceStatus]}>
                          {statusLabel(active.invoiceStatus, t)}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {active
                        ? t('profile.staffFiles.uploadedOn', { date: dateLabel(active.createdAt) })
                        : t('profile.staffFiles.noActiveInvoice')}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canUploadForMonth && (
                    <Button variant="outline" size="sm" onClick={() => onUpload(item.year, item.month, Boolean(active))}>
                      <Upload className="mr-1.5 h-4 w-4" />
                      {active ? t('profile.staffFiles.replace') : t('profile.staffFiles.addInvoice')}
                    </Button>
                  )}
                  {active && (
                    <Button variant="outline" size="sm" onClick={() => onDownload(active)}>
                      <Download className="mr-1.5 h-4 w-4" />
                      {t('profile.staffFiles.download')}
                    </Button>
                  )}
                  {active && canDelete(active) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDelete(active)}
                      disabled={deletingFileId === active.id}
                      className={cn('border-destructive/50 text-destructive hover:bg-destructive/10')}
                    >
                      {deletingFileId === active.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
                      {t('profile.staffFiles.delete')}
                    </Button>
                  )}
                  {item.history.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const next = new Set(expandedMonths)
                        if (expanded) next.delete(key)
                        else next.add(key)
                        setExpandedMonths(next)
                      }}
                    >
                      <History className="mr-1.5 h-4 w-4" />
                      {t('profile.staffFiles.history')}
                    </Button>
                  )}
                </div>
              </div>

              {active && canManageInvoiceStatus && nextStatuses(active.invoiceStatus).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 pl-0 lg:pl-11">
                  {nextStatuses(active.invoiceStatus).map((status) => (
                    <Button
                      key={status}
                      variant="outline"
                      size="sm"
                      disabled={updatingFileId === active.id}
                      onClick={() => onStatusChange(active, status)}
                    >
                      {status === 'PAID' ? <DollarSign className="mr-1.5 h-4 w-4" /> : status === 'REJECTED' ? <XCircle className="mr-1.5 h-4 w-4" /> : <CheckCircle className="mr-1.5 h-4 w-4" />}
                      {statusLabel(status, t)}
                    </Button>
                  ))}
                </div>
              )}

              {expanded && (
                <div className="mt-3 space-y-2 pl-0 lg:pl-11">
                  {item.history.map((file) => (
                    <div key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">{file.title} · {dateLabel(file.createdAt)}</span>
                      <Button variant="outline" size="sm" onClick={() => onDownload(file)}>
                        <Download className="mr-1.5 h-4 w-4" />
                        {t('profile.staffFiles.download')}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
