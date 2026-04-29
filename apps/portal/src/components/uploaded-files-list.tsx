/**
 * Uploaded Files List
 * Fetches per-entity uploads, supports optimistic delete and external refetch.
 * Parent calls `refetch()` via the imperative ref after upload completes.
 */
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
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

export const UploadedFilesList = forwardRef<
  UploadedFilesListHandle,
  UploadedFilesListProps
>(function UploadedFilesList({ token, caseId }, ref) {
  const { t } = useTranslation()
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const isMountedRef = useRef(true)

  const fetchUploads = useCallback(async () => {
    setLoading(true)
    try {
      const result = await portalApi.getEntityUploads(token, caseId)
      if (isMountedRef.current) {
        setFiles(result.uploads)
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : t('portal.errorLoading')
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

  const handleDelete = useCallback(
    async (id: string) => {
      let removed: UploadedFile | null = null
      // Optimistic remove — capture the row so we can re-insert on failure
      // without disturbing concurrent in-flight deletes (functional revert).
      setFiles((curr) => {
        const found = curr.find((f) => f.id === id)
        if (found) removed = found
        return curr.filter((f) => f.id !== id)
      })
      setDeletingIds((curr) => new Set(curr).add(id))

      try {
        await portalApi.deleteFile(token, id)
        toast.success(t('portal.uploadedFiles.deleted'))
      } catch (err) {
        // Revert: re-insert just the failed row, sorted by createdAt desc
        if (isMountedRef.current && removed) {
          const restored: UploadedFile = removed
          setFiles((curr) =>
            [...curr, restored].sort((a, b) =>
              b.createdAt.localeCompare(a.createdAt)
            )
          )
        }
        const message =
          err instanceof ApiError ? err.message : t('portal.errorLoading')
        toast.error(message)
      } finally {
        if (isMountedRef.current) {
          setDeletingIds((curr) => {
            const next = new Set(curr)
            next.delete(id)
            return next
          })
        }
      }
    },
    [token, t]
  )

  return (
    <section
      aria-labelledby="uploaded-files-heading"
      className="space-y-3"
    >
      <h3
        id="uploaded-files-heading"
        className="text-sm font-semibold text-foreground"
      >
        {t('portal.uploadedFiles.heading')}
      </h3>

      {loading && files.length === 0 ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden="true" />
          <span className="text-sm">{t('common.loading')}</span>
        </div>
      ) : files.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {t('portal.uploadedFiles.empty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {files.map((file) => (
            <UploadedFileRow
              key={file.id}
              file={file}
              onDelete={handleDelete}
              isDeleting={deletingIds.has(file.id)}
            />
          ))}
        </ul>
      )}
    </section>
  )
})
