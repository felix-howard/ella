import { useEffect, useRef, useState } from 'react'
import { Check, FileText, Loader2, X } from 'lucide-react'
import { Badge, cn } from '@ella/ui'
import type { StaffFileListItem } from '../../lib/api-client'
import { StaffFileActionMenu } from './staff-file-action-menu'

interface StaffFileListProps {
  files: StaffFileListItem[]
  isLoading: boolean
  emptyTitle: string
  emptyDescription: string
  onOpen: (file: StaffFileListItem) => void
  onOpenInNewTab: (file: StaffFileListItem) => void
  onDownload: (file: StaffFileListItem) => void
  onRename: (file: StaffFileListItem, title: string) => void
  onStartRename: (file: StaffFileListItem) => void
  onCancelRename: () => void
  onDelete: (file: StaffFileListItem) => void
  canDelete: (file: StaffFileListItem) => boolean
  renamingFileId?: string | null
  updatingFileId?: string | null
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
  onOpen,
  onOpenInNewTab,
  onDownload,
  onRename,
  onStartRename,
  onCancelRename,
  onDelete,
  canDelete,
  renamingFileId,
  updatingFileId,
  deletingFileId,
}: StaffFileListProps) {
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
          <div
            key={file.id}
            className={cn(
              'flex flex-col gap-3 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between',
              renamingFileId === file.id ? 'cursor-default' : 'cursor-pointer'
            )}
            role={renamingFileId === file.id ? undefined : 'button'}
            tabIndex={renamingFileId === file.id ? undefined : 0}
            onClick={() => {
              if (renamingFileId !== file.id) onOpen(file)
            }}
            onKeyDown={(event) => {
              if (renamingFileId === file.id) return
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onOpen(file)
              }
            }}
          >
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                {renamingFileId === file.id ? (
                  <StaffFileInlineRenameInput
                    title={file.title}
                    isPending={updatingFileId === file.id}
                    onSave={(title) => onRename(file, title)}
                    onCancel={onCancelRename}
                  />
                ) : (
                  <p className="truncate text-sm font-medium text-foreground">{file.title}</p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatDate(file.createdAt)}</span>
                  <span>{formatFileSize(file.fileSize)}</span>
                  {file.category && <Badge variant="outline">{file.category}</Badge>}
                </div>
              </div>
            </div>
            <StaffFileActionMenu
              file={file}
              canDelete={canDelete(file)}
              isDeleting={deletingFileId === file.id}
              onOpenInNewTab={onOpenInNewTab}
              onDownload={onDownload}
              onRename={onStartRename}
              onDelete={onDelete}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export function StaffFileInlineRenameInput({
  title,
  isPending,
  onSave,
  onCancel,
}: {
  title: string
  isPending: boolean
  onSave: (title: string) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }, [title])

  const save = () => {
    const nextTitle = draft.trim()
    if (!nextTitle || nextTitle === title || isPending) {
      onCancel()
      return
    }
    onSave(nextTitle)
  }

  return (
    <div className="flex w-full min-w-0 max-w-2xl items-center gap-2 sm:min-w-[28rem]" onClick={(event) => event.stopPropagation()}>
      <input
        ref={inputRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === 'Enter') save()
          if (event.key === 'Escape') onCancel()
        }}
        disabled={isPending}
        className="h-9 min-w-0 flex-1 rounded-md border border-primary bg-background px-2 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
        aria-label="Rename file"
      />
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        onClick={save}
        disabled={!draft.trim() || isPending}
        aria-label="Save file name"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      </button>
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
        onClick={onCancel}
        disabled={isPending}
        aria-label="Cancel rename"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
