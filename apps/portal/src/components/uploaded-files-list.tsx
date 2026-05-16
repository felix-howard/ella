/**
 * Uploaded Files List
 * Fetches per-entity uploads and supports external refetch.
 * Parent calls `refetch()` via the imperative ref after upload completes.
 */
import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Loader2 } from 'lucide-react'
import { portalApi, type UploadedFile, ApiError } from '../lib/api-client'
import { toast } from '../lib/toast-store'
import { UploadedFileRow } from './uploaded-file-row'

interface UploadedFilesListProps {
  token: string
  caseId: string
}

export interface UploadedFilesListHandle {
  refetch: () => void
}

export const UploadedFilesList = forwardRef<UploadedFilesListHandle, UploadedFilesListProps>(
  function UploadedFilesList({ token, caseId }, ref) {
    const { t } = useTranslation()
    const [files, setFiles] = useState<UploadedFile[]>([])
    const [loading, setLoading] = useState(true)
    const isMountedRef = useRef(true)

    const fetchUploads = useCallback(async () => {
      setLoading(true)
      try {
        const result = await portalApi.getEntityUploads(token, caseId)
        if (isMountedRef.current) {
          setFiles(result.uploads)
        }
      } catch (err) {
        const message = err instanceof ApiError ? err.message : t('portal.errorLoading')
        toast.error(message)
      } finally {
        if (isMountedRef.current) setLoading(false)
      }
    }, [token, caseId, t])

    useEffect(() => {
      isMountedRef.current = true
      fetchUploads()
      return () => {
        isMountedRef.current = false
      }
    }, [fetchUploads])

    useImperativeHandle(ref, () => ({ refetch: fetchUploads }), [fetchUploads])

    return (
      <section aria-labelledby="uploaded-files-heading" className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h3
            id="uploaded-files-heading"
            className="text-xl font-semibold text-foreground sm:text-2xl"
          >
            {t('portal.uploadedFiles.heading')}
          </h3>
          {files.length > 0 && (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              {files.length}
            </span>
          )}
        </div>

        {loading && files.length === 0 ? (
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-300/80 py-8 text-muted-foreground sm:py-10">
            <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />
            <span className="text-sm">{t('common.loading')}</span>
          </div>
        ) : files.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300/80 bg-white/45 px-6 py-8 text-center sm:py-10">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <FileText className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="text-base font-medium text-muted-foreground sm:text-lg">
              {t('portal.uploadedFiles.empty')}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {files.map((file) => (
              <UploadedFileRow key={file.id} file={file} />
            ))}
          </ul>
        )}
      </section>
    )
  }
)
