/**
 * AddSectionInlineForm - Create new shared doc section
 * Title input (1-100 chars) + PDF drop zone + submit/cancel.
 */
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, X } from 'lucide-react'
import { Button, Input } from '@ella/ui'
import { toast } from '../../stores/toast-store'
import { SharedDocUploadZone } from './shared-doc-upload-zone'
import { useSharedDocs } from '../../hooks/use-shared-docs'

const TITLE_MAX = 100

interface AddSectionInlineFormProps {
  caseId: string
  onComplete: () => void
  onCancel: () => void
}

export function AddSectionInlineForm({ caseId, onComplete, onCancel }: AddSectionInlineFormProps) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const { createSection, isCreating } = useSharedDocs({ caseId })

  const handleSubmit = useCallback(async () => {
    const trimmed = title.trim()
    if (!trimmed) {
      toast.error(t('sharedDocs.errorTitleRequired'))
      return
    }
    if (trimmed.length > TITLE_MAX) {
      toast.error(t('sharedDocs.errorTitleTooLong'))
      return
    }
    if (!file) {
      toast.error(t('sharedDocs.errorPdfOnly'))
      return
    }

    try {
      await createSection({ title: trimmed, file })
      toast.success(t('sharedDocs.uploadSuccess'))
      onComplete()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('sharedDocs.uploadError'))
    }
  }, [title, file, createSection, t, onComplete])

  const canSubmit = !isCreating && title.trim().length > 0 && !!file

  return (
    <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t('sharedDocs.sectionNameLabel')}
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('sharedDocs.sectionNamePlaceholder')}
            maxLength={TITLE_MAX}
            disabled={isCreating}
            autoFocus
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isCreating}
          className="mt-6"
          aria-label={t('sharedDocs.cancel')}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {file ? (
        <div className="flex items-center justify-between gap-3 p-3 bg-muted/40 rounded-lg border border-border">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFile(null)}
            disabled={isCreating}
          >
            {t('sharedDocs.cancel')}
          </Button>
        </div>
      ) : (
        <SharedDocUploadZone onFileSelected={setFile} compact isUploading={isCreating} />
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isCreating}>
          {t('sharedDocs.cancel')}
        </Button>
        <Button variant="default" size="sm" onClick={handleSubmit} disabled={!canSubmit}>
          {isCreating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t('sharedDocs.uploading')}
            </>
          ) : (
            t('sharedDocs.submitCreate')
          )}
        </Button>
      </div>
    </div>
  )
}
