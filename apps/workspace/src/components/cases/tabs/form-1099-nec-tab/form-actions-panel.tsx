/**
 * Form Actions Panel - TaxBandits workflow actions
 * Sequential steps: Create -> Get PDFs -> Transmit to IRS
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, FileText, Download, Send, Archive, Users } from 'lucide-react'
import JSZip from 'jszip'
import { Button } from '@ella/ui'
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
  businessId: string
}

export function FormActionsPanel({ businessId }: FormActionsPanelProps) {
  const queryClient = useQueryClient()

  const { data: statusData, isLoading } = useQuery({
    queryKey: ['form-1099-status', businessId],
    queryFn: () => api.form1099nec.status(businessId),
  })

  const status: Form1099StatusCounts = statusData?.data ?? {
    draft: 0,
    validated: 0,
    imported: 0,
    pdfReady: 0,
    submitted: 0,
    accepted: 0,
    rejected: 0,
    total: 0,
  }

  const refreshStatus = () => {
    queryClient.invalidateQueries({ queryKey: ['form-1099-status', businessId] })
    queryClient.invalidateQueries({ queryKey: ['contractors', businessId] })
  }

  const createMutation = useMutation({
    mutationFn: () => api.form1099nec.create(businessId),
    onSuccess: (data) => {
      toast.success(`Created ${data.createdCount} forms in TaxBandits`)
      if (data.errors && data.errors.length > 0) {
        toast.error(`${data.errors.length} form(s) had errors`)
      }
      refreshStatus()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Form creation failed')
    },
  })

  const fetchPdfsMutation = useMutation({
    mutationFn: () => api.form1099nec.fetchPdfs(businessId),
    onSuccess: (data) => {
      toast.success(`Fetched ${data.pdfCount} PDFs`)
      refreshStatus()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'PDF fetch failed')
    },
  })

  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownloadAll = async () => {
    setIsDownloading(true)
    try {
      const { data: pdfs } = await api.form1099nec.getAllPdfs(businessId)
      await downloadPdfsAsZip(pdfs, '1099-NEC-forms.zip', 'PDFs')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setIsDownloading(false)
    }
  }

  const fetchRecipientMutation = useMutation({
    mutationFn: () => api.form1099nec.fetchRecipientPdfs(businessId),
    onSuccess: (data) => {
      toast.success(`Fetched ${data.pdfCount} recipient PDFs`)
      if (data.errors && data.errors.length > 0) {
        toast.error(`${data.errors.length} record(s) had errors`)
      }
      refreshStatus()
      queryClient.invalidateQueries({ queryKey: ['recipient-pdfs', businessId] })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Recipient PDF fetch failed')
    },
  })

  const [isDownloadingRecipient, setIsDownloadingRecipient] = useState(false)

  const handleDownloadRecipient = async () => {
    setIsDownloadingRecipient(true)
    try {
      const { data: pdfs } = await api.form1099nec.getRecipientPdfs(businessId)
      await downloadPdfsAsZip(pdfs, '1099-NEC-recipient-copies.zip', 'recipient PDFs')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setIsDownloadingRecipient(false)
    }
  }

  const [showConfirm, setShowConfirm] = useState(false)

  const transmitMutation = useMutation({
    mutationFn: () => api.form1099nec.transmit(businessId),
    onSuccess: (data) => {
      toast.success(`Transmitted ${data.transmittedCount} forms to IRS`)
      refreshStatus()
      queryClient.invalidateQueries({ queryKey: ['filing-batches', businessId] })
      setShowConfirm(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Transmission failed')
      setShowConfirm(false)
    },
  })

  if (isLoading || status.total === 0) return null

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{status.draft}</span> draft
          </span>
          <span>
            <span className="font-medium text-foreground">{status.imported}</span> created
          </span>
          <span>
            <span className="font-medium text-foreground">{status.pdfReady}</span> ready
          </span>
          {status.submitted > 0 && (
            <span>
              <span className="font-medium text-foreground">{status.submitted}</span> transmitted
            </span>
          )}
          {status.accepted > 0 && (
            <span>
              <span className="font-medium text-foreground">{status.accepted}</span> accepted
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={status.draft === 0 || createMutation.isPending}
            className="gap-1.5"
          >
            {createMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileText className="w-3.5 h-3.5" />
            )}
            1. Create
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchPdfsMutation.mutate()}
            disabled={status.imported === 0 || fetchPdfsMutation.isPending}
            className="gap-1.5"
          >
            {fetchPdfsMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            2. Get PDFs
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadAll}
            disabled={status.pdfReady === 0 || isDownloading}
            className="gap-1.5"
          >
            {isDownloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Archive className="w-3.5 h-3.5" />
            )}
            Download All
          </Button>

          {showConfirm ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Transmit {status.pdfReady} forms?</span>
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
                Confirm
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConfirm(false)}
                disabled={transmitMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowConfirm(true)}
              disabled={status.pdfReady === 0}
              className="gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              3. Transmit to IRS
            </Button>
          )}

          {(status.submitted > 0 || status.accepted > 0) && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchRecipientMutation.mutate()}
                disabled={fetchRecipientMutation.isPending}
                className="gap-1.5"
              >
                {fetchRecipientMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Users className="w-3.5 h-3.5" />
                )}
                4. Get Recipient Copies
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadRecipient}
                disabled={isDownloadingRecipient}
                className="gap-1.5"
                title="Download Copy B PDFs (final copies for contractors)"
              >
                {isDownloadingRecipient ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Archive className="w-3.5 h-3.5" />
                )}
                Download Recipient Copies
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
