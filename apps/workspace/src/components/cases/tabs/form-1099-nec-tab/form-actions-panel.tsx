/**
 * Form Actions Panel - TaxBandits workflow actions
 * Sequential steps: Create -> Get PDFs -> Transmit to IRS
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, FileText, Download, Send, Archive } from 'lucide-react'
import JSZip from 'jszip'
import { Button } from '@ella/ui'
import { api, type Form1099StatusCounts } from '../../../../lib/api-client'
import { toast } from '../../../../stores/toast-store'

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
      if (!pdfs.length) {
        toast.error('No PDFs available to download')
        return
      }

      const zip = new JSZip()
      const results = await Promise.allSettled(
        pdfs.map(async (pdf) => {
          const res = await fetch(pdf.url)
          if (!res.ok) throw new Error(`Failed to download ${pdf.filename}`)
          const blob = await res.blob()
          zip.file(pdf.filename, blob)
        })
      )

      const failed = results.filter((r) => r.status === 'rejected').length
      if (failed > 0) {
        toast.error(`${failed} PDF(s) failed to download`)
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(zipBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = '1099-NEC-forms.zip'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(`Downloaded ${pdfs.length - failed} PDFs as zip`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setIsDownloading(false)
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
        </div>
      </div>
    </div>
  )
}
