/**
 * Client Overview — read-only "NDA & Agreement" section. Surfaces NDAs that
 * were transferred from the source lead during conversion. Latest NDA shows
 * by default; a "View all" toggle expands the rest. Footer link routes back
 * to the original Lead page for any management action (resend / deposit edit).
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { FileSignature, ArrowRight, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { api, type ClientDetail } from '../../../lib/api-client'
import { NdaReadonlyCard } from '../../nda/nda-readonly-card'

interface Props {
  client: ClientDetail
}

export function ClientNdaSection({ client }: Props) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['client-nda', client.id],
    queryFn: () => api.clients.nda.list(client.id),
    staleTime: 60_000,
  })

  // Source lead used for "View PDF" presigned URL + "Manage on lead page" link.
  // `convertedLeads` is ordered by convertedAt desc on the backend.
  const leadId = client.convertedLeads?.[0]?.id

  const ndas = data?.data ?? []
  const latest = ndas[0]
  const rest = ndas.slice(1)

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
        {leadId && (
          <Link
            to="/leads/$leadId"
            params={{ leadId }}
            className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
          >
            {t('clientOverview.nda.manageOnLead')}
            <ArrowRight className="w-3 h-3" />
          </Link>
        )}
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

      {!isLoading && !isError && ndas.length === 0 && (
        <div className="bg-muted/30 rounded-lg p-6 text-center">
          <FileSignature className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            {t('clientOverview.nda.empty')}
          </p>
          {leadId && (
            <Link
              to="/leads/$leadId"
              params={{ leadId }}
              className="inline-block mt-2 text-xs font-medium text-primary hover:underline"
            >
              {t('clientOverview.nda.sendViaLead')}
            </Link>
          )}
        </div>
      )}

      {!isLoading && !isError && latest && (
        <div className="space-y-3">
          <NdaReadonlyCard nda={latest} leadId={leadId} showViewPdf />

          {rest.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    {t('clientOverview.nda.collapse')}
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    {t('clientOverview.nda.viewAll', { count: ndas.length })}
                  </>
                )}
              </button>

              {expanded && (
                <div className="space-y-3 pt-2 border-t border-border/40">
                  {rest.map((nda) => (
                    <NdaReadonlyCard
                      key={nda.id}
                      nda={nda}
                      leadId={leadId}
                      showViewPdf
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
