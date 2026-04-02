/**
 * Form Actions Panel - Tax1099 workflow actions
 * Sequential steps: Validate -> Import -> Get PDFs -> Submit to IRS
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, CheckCircle2, FileText, Download, Send } from 'lucide-react'
import { Button } from '@ella/ui'
import { api, type Form1099StatusCounts } from '../../../../lib/api-client'
import { toast } from '../../../../stores/toast-store'

interface FormActionsPanelProps {
  clientId: string
}

export function FormActionsPanel({ clientId }: FormActionsPanelProps) {
  const queryClient = useQueryClient()

  const { data: statusData, isLoading } = useQuery({
    queryKey: ['form-1099-status', clientId],
    queryFn: () => api.form1099nec.status(clientId),
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
    queryClient.invalidateQueries({ queryKey: ['form-1099-status', clientId] })
    queryClient.invalidateQueries({ queryKey: ['contractors', clientId] })
  }

  const validateMutation = useMutation({
    mutationFn: () => api.form1099nec.validate(clientId),
    onSuccess: (data) => {
      const validCount = data.results.filter((r) => r.valid).length
      const totalCount = data.results.length
      toast.success(`Validation complete: ${validCount}/${totalCount} passed`)
      refreshStatus()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Validation failed')
    },
  })

  const importMutation = useMutation({
    mutationFn: () => api.form1099nec.import(clientId),
    onSuccess: (data) => {
      toast.success(`Imported ${data.importedCount} forms to Tax1099`)
      refreshStatus()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    },
  })

  const fetchPdfsMutation = useMutation({
    mutationFn: () => api.form1099nec.fetchPdfs(clientId),
    onSuccess: (data) => {
      toast.success(`Fetched ${data.pdfCount} PDFs`)
      refreshStatus()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'PDF fetch failed')
    },
  })

  const [showConfirm, setShowConfirm] = useState(false)

  const submitMutation = useMutation({
    mutationFn: () =>
      api.form1099nec.submit(clientId, {
        tinCheckEnabled: true,
        uspsEnabled: true,
        eDeliveryEnabled: true,
      }),
    onSuccess: (data) => {
      toast.success(`Submitted ${data.submittedCount} forms to IRS`)
      if (data.rejectedCount > 0) {
        toast.error(`${data.rejectedCount} forms were rejected`)
      }
      refreshStatus()
      queryClient.invalidateQueries({ queryKey: ['filing-batches', clientId] })
      setShowConfirm(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Submission failed')
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
            <span className="font-medium text-foreground">{status.validated}</span> validated
          </span>
          <span>
            <span className="font-medium text-foreground">{status.imported}</span> imported
          </span>
          <span>
            <span className="font-medium text-foreground">{status.pdfReady}</span> ready
          </span>
          {status.submitted > 0 && (
            <span>
              <span className="font-medium text-foreground">{status.submitted}</span> submitted
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => validateMutation.mutate()}
            disabled={status.draft === 0 || validateMutation.isPending}
            className="gap-1.5"
          >
            {validateMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            1. Validate
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => importMutation.mutate()}
            disabled={status.validated === 0 || importMutation.isPending}
            className="gap-1.5"
          >
            {importMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileText className="w-3.5 h-3.5" />
            )}
            2. Import
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
            3. Get PDFs
          </Button>

          {showConfirm ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Submit {status.pdfReady} forms?</span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
                className="gap-1.5"
              >
                {submitMutation.isPending ? (
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
                disabled={submitMutation.isPending}
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
              4. Submit to IRS
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
