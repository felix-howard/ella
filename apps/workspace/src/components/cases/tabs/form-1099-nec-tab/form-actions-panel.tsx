/**
 * Form Actions Panel - 1099-NEC workflow actions
 * Two clear sections: Draft forms (needs action) and Transmitted forms (done)
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, FileCheck, Send, Download, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import JSZip from 'jszip'
import { Button, Modal, ModalHeader, ModalTitle, ModalFooter } from '@ella/ui'
import { api, type Form1099StatusCounts } from '../../../../lib/api-client'
import { toast } from '../../../../stores/toast-store'

async function downloadPdfsAsZip(
  pdfs: Array<{ url: string; filename: string }>,
  zipName: string,
  label: string
) {
  if (!pdfs.length) {
    toast.error(`No ${label} available to download`)
    return
  }

  const zip = new JSZip()
  let failed = 0
  const CHUNK = 10
  for (let i = 0; i < pdfs.length; i += CHUNK) {
    const slice = pdfs.slice(i, i + CHUNK)
    const results = await Promise.allSettled(
      slice.map(async (pdf) => {
        const res = await fetch(pdf.url)
        if (!res.ok) throw new Error(`Failed to download ${pdf.filename}`)
        const blob = await res.blob()
        zip.file(pdf.filename, blob)
      })
    )
    failed += results.filter((r) => r.status === 'rejected').length
  }

  if (failed > 0) {
    toast.error(`${failed} PDF(s) failed to download`)
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(zipBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = zipName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  toast.success(`Downloaded ${pdfs.length - failed} ${label} as zip`)
}

interface FormActionsPanelProps {
  clientId: string
}

export function FormActionsPanel({ clientId }: FormActionsPanelProps) {
  const queryClient = useQueryClient()
  const [showConfirm, setShowConfirm] = useState(false)
  const [isDownloadingA, setIsDownloadingA] = useState(false)
  const [isDownloadingB, setIsDownloadingB] = useState(false)

  const { data: statusData, isLoading } = useQuery({
    queryKey: ['form-1099-status', clientId],
    queryFn: () => api.form1099nec.status(clientId),
  })

  const status: Form1099StatusCounts = statusData?.data ?? {
    draft: 0, validated: 0, imported: 0, pdfReady: 0,
    submitted: 0, accepted: 0, rejected: 0, total: 0,
  }

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['form-1099-status', clientId] })
    queryClient.invalidateQueries({ queryKey: ['contractors', clientId] })
    queryClient.invalidateQueries({ queryKey: ['filing-batches', clientId] })
    queryClient.invalidateQueries({ queryKey: ['recipient-pdfs', clientId] })
  }

  const prepareMutation = useMutation({
    mutationFn: () => api.form1099nec.prepare(clientId),
    onSuccess: (data) => {
      toast.success(`Prepared ${data.createdCount} forms, ${data.pdfCount} PDFs ready for review`)
      if (data.createErrors && data.createErrors.length > 0) {
        for (const formErr of data.createErrors) {
          toast.error(`Form ${formErr.sequence}: ${formErr.errors?.join(', ')}`)
        }
      }
      if (data.pdfErrors && data.pdfErrors.length > 0) {
        for (const err of data.pdfErrors) toast.error(err)
      }
      refreshAll()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Form preparation failed')
    },
  })

  const transmitMutation = useMutation({
    mutationFn: () => api.form1099nec.transmit(clientId),
    onSuccess: (data) => {
      const msg = data.recipientPdfCount
        ? `Transmitted ${data.transmittedCount} forms & fetched ${data.recipientPdfCount} recipient PDFs`
        : `Transmitted ${data.transmittedCount} forms to IRS`
      toast.success(msg)
      if (data.recipientErrors && data.recipientErrors.length > 0) {
        for (const err of data.recipientErrors) toast.error(err)
      }
      refreshAll()
      setShowConfirm(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Transmission failed')
      setShowConfirm(false)
    },
  })

  const handleDownloadCopyA = async () => {
    setIsDownloadingA(true)
    try {
      const { data: pdfs } = await api.form1099nec.getAllPdfs(clientId)
      await downloadPdfsAsZip(pdfs, '1099-NEC-CopyA.zip', 'Copy A PDFs')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setIsDownloadingA(false)
    }
  }

  const handleDownloadCopyB = async () => {
    setIsDownloadingB(true)
    try {
      const { data: pdfs } = await api.form1099nec.getRecipientPdfs(clientId)
      await downloadPdfsAsZip(pdfs, '1099-NEC-CopyB.zip', 'Copy B PDFs')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setIsDownloadingB(false)
    }
  }

  if (isLoading || status.total === 0) return null

  const hasDrafts = status.draft > 0
  const hasReady = status.pdfReady > 0
  const hasTransmitted = status.submitted > 0 || status.accepted > 0
  const transmittedCount = status.submitted + status.accepted
  const allDone = !hasDrafts && !hasReady && hasTransmitted

  return (
    <div className="bg-card border-t border-border p-4 space-y-3 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
      {/* Section 1: Draft forms needing action */}
      {(hasDrafts || hasReady) && (
        <div className="flex items-center gap-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-4 py-3">
          <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {hasDrafts && hasReady
                ? `${status.draft} draft form${status.draft !== 1 ? 's' : ''} + ${status.pdfReady} ready to submit`
                : hasDrafts
                  ? `${status.draft} draft form${status.draft !== 1 ? 's' : ''} need${status.draft === 1 ? 's' : ''} preparation`
                  : `${status.pdfReady} form${status.pdfReady !== 1 ? 's' : ''} ready to submit to IRS`
              }
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasDrafts && (
              <Button
                size="sm"
                onClick={() => prepareMutation.mutate()}
                disabled={prepareMutation.isPending}
                className="gap-1.5"
              >
                {prepareMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileCheck className="w-3.5 h-3.5" />
                )}
                {prepareMutation.isPending ? 'Preparing...' : `Prepare ${status.draft} Form${status.draft !== 1 ? 's' : ''}`}
              </Button>
            )}
            {hasReady && (
              <Button
                size="sm"
                onClick={() => setShowConfirm(true)}
                disabled={hasDrafts}
                variant={hasDrafts ? 'outline' : 'default'}
                className="gap-1.5"
                title={hasDrafts ? 'Prepare all draft forms first' : undefined}
              >
                <Send className="w-3.5 h-3.5" />
                Submit {status.pdfReady} to IRS
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Section 2: Transmitted forms (completed) */}
      {hasTransmitted && (
        <div className="flex items-center gap-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              {transmittedCount} form{transmittedCount !== 1 ? 's' : ''} submitted to IRS
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadCopyA}
              disabled={isDownloadingA}
              className="gap-1.5"
            >
              {isDownloadingA ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Copy A (ZIP)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadCopyB}
              disabled={isDownloadingB}
              className="gap-1.5"
            >
              {isDownloadingB ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Copy B (ZIP)
            </Button>
          </div>
        </div>
      )}

      {/* All done state */}
      {allDone && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center">
          All forms have been submitted to the IRS
        </p>
      )}

      {/* Transmit Confirmation Modal */}
      <Modal open={showConfirm} onClose={() => !transmitMutation.isPending && setShowConfirm(false)}>
        <ModalHeader>
          <ModalTitle>Submit to IRS</ModalTitle>
        </ModalHeader>
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium">This action cannot be undone</p>
              <p className="mt-1 text-amber-700 dark:text-amber-300">
                Once submitted, forms will be filed with the IRS and cannot be recalled.
                Recipient copies (Copy B) will be fetched automatically.
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            You are about to submit <span className="font-semibold text-foreground">{status.pdfReady}</span> form(s).
            Please confirm you have reviewed all contractor information.
          </p>
        </div>
        <ModalFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfirm(false)}
            disabled={transmitMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => transmitMutation.mutate()}
            disabled={transmitMutation.isPending}
            className="gap-1.5"
          >
            {transmitMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            {transmitMutation.isPending ? 'Submitting...' : 'Confirm Submit'}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
