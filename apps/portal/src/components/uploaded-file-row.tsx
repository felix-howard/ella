/**
 * Uploaded File Row
 * Single row in the entity uploaded-files list: filename and status badge.
 */
import { FileText } from 'lucide-react'
import type { UploadedFile } from '../lib/api-client'
import { FileStatusBadge } from './file-status-badge'

interface UploadedFileRowProps {
  file: UploadedFile
}

export function UploadedFileRow({ file }: UploadedFileRowProps) {
  const display = file.displayName ?? file.filename

  return (
    <li className="flex items-center gap-4 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-sm">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
        aria-hidden="true"
      >
        <FileText className="h-5 w-5" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="truncate text-base font-semibold text-foreground">{display}</p>
        <div className="mt-1">
          <FileStatusBadge status={file.status} />
        </div>
      </div>
    </li>
  )
}
