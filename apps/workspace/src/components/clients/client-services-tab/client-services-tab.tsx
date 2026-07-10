import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@ella/ui'
import {
  api,
  type ClientServiceLog,
  type CreateClientServiceLogInput,
  type UpdateClientServiceLogInput,
} from '../../../lib/api-client'
import { toast } from '../../../stores/toast-store'
import { ActiveServiceSummary } from './active-service-summary'
import { ServiceLogEditModal } from './service-log-edit-modal'
import { ServiceLogQuickAdd } from './service-log-quick-add'
import { ServiceLogTimeline } from './service-log-timeline'
import {
  ACTIVE_SERVICE_STATUSES,
  compareActiveServices,
  compareServiceLogsNewestFirst,
} from './service-log-labels'

interface ClientServicesTabProps {
  clientId: string
  defaultTaxYear?: number | null
}

const serviceLogQueryKey = (clientId: string, scope: 'latest' | 'active' = 'latest') =>
  ['client-service-logs', clientId, scope] as const

export function ClientServicesTab({ clientId, defaultTaxYear }: ClientServicesTabProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [editingLog, setEditingLog] = useState<ClientServiceLog | null>(null)

  const latestQuery = useQuery({
    queryKey: serviceLogQueryKey(clientId, 'latest'),
    queryFn: () => api.clients.serviceLogs.list(clientId, { limit: 200 }),
    staleTime: 30_000,
  })
  const activeQuery = useQuery({
    queryKey: serviceLogQueryKey(clientId, 'active'),
    queryFn: () =>
      api.clients.serviceLogs.list(clientId, {
        limit: 200,
        status: ['WAITING_ON_CLIENT', 'ACTIVE'],
      }),
    staleTime: 30_000,
  })

  const invalidateServiceLogs = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['client-service-logs', clientId] }),
      queryClient.invalidateQueries({ queryKey: ['activity', 'client', clientId] }),
    ])
  }

  const createMutation = useMutation({
    mutationFn: (payload: CreateClientServiceLogInput) =>
      api.clients.serviceLogs.create(clientId, payload),
    onSuccess: async () => {
      await invalidateServiceLogs()
      toast.success(t('clientServices.createSuccess'))
    },
    onError: () => toast.error(t('clientServices.createError')),
  })

  const updateMutation = useMutation({
    mutationFn: ({
      serviceLogId,
      payload,
    }: {
      serviceLogId: string
      payload: UpdateClientServiceLogInput
    }) => api.clients.serviceLogs.update(clientId, serviceLogId, payload),
    onSuccess: async () => {
      await invalidateServiceLogs()
      setEditingLog(null)
      toast.success(t('clientServices.updateSuccess'))
    },
    onError: () => toast.error(t('clientServices.updateError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (serviceLogId: string) => api.clients.serviceLogs.delete(clientId, serviceLogId),
    onSuccess: async () => {
      await invalidateServiceLogs()
      setEditingLog(null)
      toast.success(t('clientServices.deleteSuccess'))
    },
    onError: () => toast.error(t('clientServices.deleteError')),
  })

  const logs = useMemo(
    () => [...(latestQuery.data?.data ?? [])].sort(compareServiceLogsNewestFirst),
    [latestQuery.data?.data]
  )
  const activeLogs = useMemo(
    () =>
      [...(activeQuery.data?.data ?? [])]
        .filter((log) => ACTIVE_SERVICE_STATUSES.has(log.status))
        .sort(compareActiveServices),
    [activeQuery.data?.data]
  )

  return (
    <div className="space-y-5">
      <ServiceLogQuickAdd
        key={defaultTaxYear ?? 'no-default-year'}
        defaultTaxYear={defaultTaxYear}
        isSubmitting={createMutation.isPending}
        onSubmit={(payload) => createMutation.mutateAsync(payload).then(() => undefined)}
      />

      {latestQuery.isLoading || activeQuery.isLoading ? (
        <ServiceLogLoadingState />
      ) : latestQuery.isError || activeQuery.isError ? (
        <ServiceLogErrorState
          onRetry={() => {
            void latestQuery.refetch()
            void activeQuery.refetch()
          }}
        />
      ) : (
        <>
          <ActiveServiceSummary logs={activeLogs} onEdit={setEditingLog} />
          <ServiceLogTimeline logs={logs} onEdit={setEditingLog} />
        </>
      )}

      <ServiceLogEditModal
        log={editingLog}
        isSaving={updateMutation.isPending}
        isDeleting={deleteMutation.isPending}
        onClose={() => setEditingLog(null)}
        onSave={(serviceLogId, payload) =>
          updateMutation.mutateAsync({ serviceLogId, payload }).then(() => undefined)
        }
        onDelete={(serviceLogId) => deleteMutation.mutateAsync(serviceLogId).then(() => undefined)}
      />
    </div>
  )
}

function ServiceLogLoadingState() {
  const { t } = useTranslation()
  return (
    <section className="rounded-xl border border-border bg-card p-6 text-center shadow-sm">
      <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      <p className="mt-3 text-sm text-muted-foreground">{t('clientServices.loading')}</p>
    </section>
  )
}

function ServiceLogErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center shadow-sm">
      <AlertCircle className="mx-auto h-7 w-7 text-destructive" aria-hidden="true" />
      <p className="mt-3 text-sm font-medium text-destructive">
        {t('clientServices.loadError')}
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry} className="mt-4">
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        {t('common.retry')}
      </Button>
    </section>
  )
}
