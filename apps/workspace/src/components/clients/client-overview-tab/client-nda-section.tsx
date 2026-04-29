/**
 * Client Overview — compact "NDA & Agreement" summary card. Shows count badge
 * + latest NDA card with a "View all" link that deep-links into the Agreements
 * tab where staff can send/manage NDAs. The Agreements tab handles the full
 * list and all mutations; this card is read-only and renders only the latest.
 */
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { FileSignature, ArrowRight, Loader2 } from 'lucide-react'
import { api, type ClientDetail } from '../../../lib/api-client'
import { NdaReadonlyCard } from '../../nda/nda-readonly-card'

interface Props {
  client: ClientDetail
}

export function ClientNdaSection({ client }: Props) {
  const { t } = useTranslation()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['nda', 'client', client.id, 'list'],
    queryFn: () => api.clients.nda.list(client.id),
    staleTime: 60_000,
  })

  const ndas = data?.data ?? []
  const latest = ndas[0]

  return (
    <section className="bg-card rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-white/[0.06] p-6">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileSignature className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            {t('clientOverview.nda.title')}
          </h3>
          {ndas.length > 0 && (
            <span className="text-xs text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
              {ndas.length}
            </span>
          )}
        </div>
        <Link
          to="/clients/$clientId"
          params={{ clientId: client.id }}
          search={{ tab: 'agreements' }}
          className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
        >
          {t('clientOverview.nda.viewAll', { count: ndas.length })}
          <ArrowRight className="w-3 h-3" />
        </Link>
      </header>

      {isLoading && (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}

      {isError && !isLoading && (
        <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-sm">
          {t('clientOverview.nda.loadError')}
        </div>
      )}

      {!isLoading && !isError && !latest && (
        <div className="bg-muted/30 rounded-lg p-6 text-center">
          <FileSignature className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {t('clientOverview.nda.empty')}
          </p>
        </div>
      )}

      {!isLoading && !isError && latest && (
        <NdaReadonlyCard
          nda={latest}
          entity={{ type: 'client', id: client.id }}
          showViewPdf
        />
      )}
    </section>
  )
}
