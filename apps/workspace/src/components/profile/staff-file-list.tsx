import { Download, FileText, Loader2, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Badge, cn } from '@ella/ui'
import type { StaffFileListItem } from '../../lib/api-client'

interface StaffFileListProps {
  files: StaffFileListItem[]
  isLoading: boolean
  emptyTitle: string
  emptyDescription: string
  onDownload: (file: StaffFileListItem) => void
  onDelete: (file: StaffFileListItem) => void
  canDelete: (file: StaffFileListItem) => boolean
  deletingFileId?: string | null
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

export function StaffFileList({
  files,
  isLoading,
  emptyTitle,
  emptyDescription,
  onDownload,
  onDelete,
  canDelete,
  deletingFileId,
}: StaffFileListProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl bg-card py-12 shadow-sm">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="rounded-xl bg-card p-6 text-center shadow-sm">
        <FileText className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
        <h3 className="text-base font-semibold text-foreground">{emptyTitle}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{emptyDescription}</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-sm">
      <div className="divide-y divide-border">
        {files.map((file) => (
          <div key={file.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{file.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatDate(file.createdAt)}</span>
                  <span>{formatFileSize(file.fileSize)}</span>
                  {file.category && <Badge variant="outline">{file.category}</Badge>}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              <Button variant="outline" size="sm" onClick={() => onDownload(file)}>
                <Download className="mr-1.5 h-4 w-4" />
                {t('profile.staffFiles.download')}
              </Button>
              {canDelete(file) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(file)}
                  disabled={deletingFileId === file.id}
                  className={cn('border-destructive/50 text-destructive hover:bg-destructive/10')}
                >
                  {deletingFileId === file.id ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-1.5 h-4 w-4" />
                  )}
                  {t('profile.staffFiles.delete')}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
