/**
 * Full-screen editor modal for customizing NDA content per-lead before sending.
 * Preloads default HTML (variables substituted) via TanStack Query, lets staff
 * edit through the existing RichTextEditor, and submits via useCreateNda.
 * Preview hook delegated to caller (Phase 05 wires the preview modal).
 *
 * Caller mounts this only when the editor is open so internal state resets
 * naturally on close (no setState-in-effect needed).
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Loader2, X, RotateCcw, Send, FileText } from 'lucide-react'
import { RichTextEditor } from '../rich-text-editor'
import { useNdaDefaultHtml } from './use-nda-default-html'
import { useCreateNda } from './use-nda-mutations'
import { formatPhone } from '../../../lib/formatters'
import type { Lead } from '../../../lib/api-client'

interface Props {
  onClose: () => void
  lead: Pick<Lead, 'id' | 'firstName' | 'lastName' | 'phone'>
  onPreviewClick: (currentHtml: string) => void
}

export function NdaEditorModal({ onClose, lead, onPreviewClick }: Props) {
  const { t } = useTranslation()
  const defaultQuery = useNdaDefaultHtml(lead.id, true)
  const mutation = useCreateNda(lead.id)

  // `html` is null until the user edits. Render uses derived `effectiveHtml`
  // that falls back to the fetched default — keeps editor controlled without
  // a setState-on-mount hydration effect.
  const [html, setHtml] = useState<string | null>(null)
  const defaultHtml = defaultQuery.data?.data.contentHtml ?? ''
  const effectiveHtml = html ?? defaultHtml

  // Esc closes (only when no pending mutation)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !mutation.isPending) {
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mutation.isPending, onClose])

  const isDirty = html !== null && html !== defaultHtml
  const canSubmit =
    !!effectiveHtml.trim() &&
    !defaultQuery.isLoading &&
    !defaultQuery.isError &&
    !mutation.isPending

  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ')

  const handleReset = () => {
    if (!isDirty) return
    if (window.confirm(t('nda.editor.resetConfirm'))) setHtml(null)
  }

  const handleSend = () => {
    mutation.mutate({ contentHtml: effectiveHtml }, { onSuccess: () => onClose() })
  }

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/50 z-[10000]"
        onClick={() => !mutation.isPending && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nda-editor-title"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[10001] w-full max-w-4xl max-h-[90vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 id="nda-editor-title" className="text-lg font-semibold text-foreground">
              {t('nda.editor.title')}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {fullName} · {formatPhone(lead.phone)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            aria-label={t('common.close')}
            className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {defaultQuery.isLoading ? (
            <div className="flex items-center justify-center h-[480px]">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : defaultQuery.isError ? (
            <p className="text-destructive text-sm">{t('nda.editor.loadError')}</p>
          ) : (
            <RichTextEditor
              value={effectiveHtml}
              onChange={setHtml}
              maxLength={50000}
              className="min-h-[480px]"
            />
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 px-6 py-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={!isDirty || mutation.isPending}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            {t('nda.editor.reset')}
          </button>
          <button
            type="button"
            onClick={() => onPreviewClick(effectiveHtml)}
            disabled={!canSubmit}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            {t('nda.editor.preview')}
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSubmit}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {mutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {t('nda.send.confirmCta')}
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}
