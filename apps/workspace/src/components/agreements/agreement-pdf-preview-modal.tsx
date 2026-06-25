/**
 * PDF preview modal stacked above the editor. POSTs editor HTML to the entity's
 * preview-pdf endpoint, renders desktop through native PDF iframe and mobile
 * through react-pdf to avoid mobile iframe scroll bugs. cancelRef gates onSuccess
 * against stale fetches; handleClose revokes the blob URL synchronously.
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Loader2, X, Download, RotateCw, Send } from 'lucide-react'
import { useAgreementPreview } from './use-agreement-mutations'
import { useIsMobile } from '../../hooks'
import type { EntityRef } from './types'
import type { AgreementType } from '../../lib/api-client'

const PdfViewer = lazy(() => import('../ui/pdf-viewer'))

interface Props {
  open: boolean
  entity: EntityRef
  contentHtml: string
  /** Agreement type drives the modal heading. Defaults to NDA for legacy callers. */
  type?: AgreementType
  /** Title rendered as the PDF heading inside the iframe. Falls back to type label. */
  title?: string
  onClose: () => void
  /** When provided, footer renders a Send button — gated on the preview having
   *  rendered, forcing the user to look at the PDF before dispatching. */
  onSend?: () => void
  /** Outer submission state — disables Send and swaps icon for a spinner. */
  isSending?: boolean
  /** Reason to disable Send after preview renders, e.g. draft conflict. */
  sendDisabledReason?: string | null
}

const BTN_CLS = 'min-h-11 px-3 py-1.5 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors inline-flex items-center justify-center gap-2'

function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window)
}

export function NdaPdfPreviewModal({
  open,
  entity,
  contentHtml,
  type,
  title,
  onClose,
  onSend,
  isSending,
  sendDisabledReason,
}: Props) {
  const { t } = useTranslation()
  const mutation = useAgreementPreview(entity)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const cancelRef = useRef(false)
  const isMobile = useIsMobile()
  const useMobilePdfViewer = isMobile || isIOSDevice()

  const typeLabel = t(`agreements.type.${type ?? 'NDA'}`)
  const headerTitle = t('agreements.preview.title', { type: typeLabel })
  const effectiveTitle = title?.trim() || typeLabel

  const clearBlob = () => setBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null })

  const startFetch = () => {
    cancelRef.current = false
    clearBlob()
    mutation.mutate({ type: type ?? 'NDA', contentHtml, title: effectiveTitle }, {
      onSuccess: (blob) => { if (!cancelRef.current) setBlobUrl(URL.createObjectURL(blob)) },
    })
  }

  const handleClose = () => {
    if (mutation.isPending || isSending) return
    cancelRef.current = true
    clearBlob()
    onClose()
  }

  const canSend = !!onSend && !!blobUrl && !mutation.isPending && !isSending && !sendDisabledReason

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
  }, [open, mutation.isPending, isSending])

  if (!open) return null
  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/60 z-[10010]" onClick={handleClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nda-preview-title"
        className="fixed inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top)_+_0.75rem)] z-[10011] flex w-full flex-col rounded-t-xl border border-border bg-card shadow-2xl md:inset-auto md:left-1/2 md:top-1/2 md:h-[90vh] md:max-w-5xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl"
      >
        <div className="flex min-h-[64px] items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-6 md:py-4">
          <div className="min-w-0">
            <h3 id="nda-preview-title" className="truncate text-base font-semibold text-foreground md:text-lg">
              {headerTitle}
            </h3>
            {sendDisabledReason && (
              <p className="mt-0.5 truncate text-xs text-amber-700">{sendDisabledReason}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {blobUrl && (
              <a href={blobUrl} download="agreement-preview.pdf" className={BTN_CLS} aria-label={t('nda.preview.download')} title={t('nda.preview.download')}>
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">{t('nda.preview.download')}</span>
              </a>
            )}
            {onSend && (
              <button
                type="button"
                onClick={onSend}
                disabled={!canSend}
                aria-label={t('nda.send.confirmCta')}
                title={sendDisabledReason ?? t('nda.send.confirmCta')}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span className="hidden sm:inline">{t('nda.send.confirmCta')}</span>
              </button>
            )}
            <button type="button" onClick={handleClose} disabled={mutation.isPending || isSending} aria-label={t('common.close')} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-muted transition-colors disabled:opacity-50">
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
          {blobUrl && !mutation.isPending && useMobilePdfViewer && (
            <div className="h-full overflow-auto overscroll-contain bg-muted p-3">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                }
              >
                <PdfViewer
                  fileUrl={blobUrl}
                  scale={1}
                  rotation={0}
                  currentPage={1}
                  onLoadSuccess={() => undefined}
                  onLoadError={() => undefined}
                  fitToWidth
                  renderAllPages
                />
              </Suspense>
            </div>
          )}
          {blobUrl && !mutation.isPending && !useMobilePdfViewer && (
            <iframe src={blobUrl} title={headerTitle} className="w-full h-full border-0" />
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}
