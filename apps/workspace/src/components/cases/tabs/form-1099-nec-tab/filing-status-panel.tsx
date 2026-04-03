/**
 * Filing Status Panel - Shows filing batch history and status
 * Allows refreshing status from TaxBandits API
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { Button, cn } from '@ella/ui'
import { api, type FilingStatusType } from '../../../../lib/api-client'
import { toast } from '../../../../stores/toast-store'

interface FilingStatusPanelProps {
  businessId: string
}

const STATUS_COLORS: Record<FilingStatusType, string> = {
  PENDING: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  SUBMITTED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  PROCESSING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  ACCEPTED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  PARTIALLY_ACCEPTED: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
}

const BORDER_COLORS: Record<FilingStatusType, string> = {
  PENDING: 'border-gray-200 dark:border-gray-700',
  SUBMITTED: 'border-blue-200 dark:border-blue-800',
  PROCESSING: 'border-yellow-200 dark:border-yellow-800',
  ACCEPTED: 'border-green-200 dark:border-green-800',
  PARTIALLY_ACCEPTED: 'border-orange-200 dark:border-orange-800',
  REJECTED: 'border-red-200 dark:border-red-800',
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function FilingStatusPanel({ businessId }: FilingStatusPanelProps) {
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ['filing-batches', businessId],
    queryFn: () => api.form1099nec.getBatches(businessId),
  })

  const refreshMutation = useMutation({
    mutationFn: (batchId: string) => api.form1099nec.refreshBatchStatus(businessId, batchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filing-batches', businessId] })
      queryClient.invalidateQueries({ queryKey: ['form-1099-status', businessId] })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to refresh status')
    },
  })

  const batches = data?.data ?? []
  if (batches.length === 0) return null

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">Filing History</h3>

      <div className="space-y-3">
        {batches.map((batch) => (
          <div
            key={batch.id}
            className={cn('p-3 rounded-lg border', BORDER_COLORS[batch.status])}
          >
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Tax Year {batch.taxYear}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {batch.totalForms} form{batch.totalForms !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Submitted: {formatDate(batch.submittedAt)}
                </div>
                {batch.status === 'PARTIALLY_ACCEPTED' && (
                  <div className="text-xs">
                    <span className="text-green-600 dark:text-green-400">{batch.acceptedForms} accepted</span>
                    {', '}
                    <span className="text-red-600 dark:text-red-400">{batch.rejectedForms} rejected</span>
                  </div>
                )}
                {batch.rejectionReason && (
                  <div className="text-xs text-red-600 dark:text-red-400">
                    {batch.rejectionReason}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className={cn('px-2 py-0.5 text-xs font-medium rounded', STATUS_COLORS[batch.status])}>
                  {batch.status.replace('_', ' ')}
                </span>
                {['SUBMITTED', 'PROCESSING'].includes(batch.status) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => refreshMutation.mutate(batch.id)}
                    disabled={refreshMutation.isPending}
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', refreshMutation.isPending && 'animate-spin')} />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
