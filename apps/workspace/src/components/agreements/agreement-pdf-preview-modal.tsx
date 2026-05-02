/**
 * PDF preview modal stacked above the editor. POSTs editor HTML to the entity's
 * preview-pdf endpoint, renders the response blob in an iframe. cancelRef gates
 * onSuccess against stale fetches; handleClose revokes the blob URL synchronously;
 * Esc uses capture-phase + stopImmediatePropagation so it doesn't dismiss the
 * editor too.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Loader2, X, Download, RotateCw } from 'lucide-react'
import { useAgreementPreview } from './use-agreement-mutations'
import type { EntityRef } from './types'
import type { AgreementType } from '../../lib/api-client'

interface Props {
  open: boolean
  entity: EntityRef
  contentHtml: string
  /** Agreement type drives the modal heading. Defaults to NDA for legacy callers. */
  type?: AgreementType
  /** Title rendered as the PDF heading inside the iframe. Falls back to type label. */
  title?: string
  onClose: () => void
}

const BTN_CLS = 'px-3 py-1.5 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors flex items-center gap-2'

export function NdaPdfPreviewModal({ open, entity, contentHtml, type, title, onClose }: Props) {
  const { t } = useTranslation()
  const mutation = useAgreementPreview(entity)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const cancelRef = useRef(false)

  const typeLabel = t(`agreements.type.${type ?? 'NDA'}`)
  const headerTitle = t('agreements.preview.title', { type: typeLabel })
  const effectiveTitle = title?.trim() || typeLabel

  const clearBlob = () => setBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null })

  const startFetch = () => {
    cancelRef.current = false
    clearBlob()
    mutation.mutate({ contentHtml, title: effectiveTitle }, {
      onSuccess: (blob) => { if (!cancelRef.current) setBlobUrl(URL.createObjectURL(blob)) },
    })
  }

  const handleClose = () => {
    if (mutation.isPending) return
    cancelRef.current = true
    clearBlob()
    onClose()
  }

  useEffect(() => {
    if (!open) return
    startFetch()
    return () => { cancelRef.current = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contentHtml, effectiveTitle])

  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }, [blobUrl])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); handleClose() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mutation.isPending])

  if (!open) return null
  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/60 z-[10010]" onClick={handleClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nda-preview-title"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[10011] w-full max-w-5xl h-[90vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 id="nda-preview-title" className="text-lg font-semibold text-foreground">
            {headerTitle}
          </h3>
          <div className="flex items-center gap-2">
            {blobUrl && (
              <a href={blobUrl} download="agreement-preview.pdf" className={BTN_CLS}>
                <Download className="w-4 h-4" />
                {t('nda.preview.download')}
              </a>
            )}
            <button type="button" onClick={handleClose} disabled={mutation.isPending} aria-label={t('common.close')} className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-50">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-muted">
          {mutation.isPending && (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {mutation.isError && !mutation.isPending && (
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <p className="text-destructive text-sm">{t('nda.preview.error')}</p>
              <button type="button" onClick={startFetch} className={BTN_CLS}>
                <RotateCw className="w-4 h-4" />
                {t('common.retry')}
              </button>
            </div>
          )}
          {blobUrl && !mutation.isPending && (
            <iframe src={blobUrl} title={headerTitle} className="w-full h-full border-0" />
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}
