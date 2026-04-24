/**
 * Lead Detail Page Route — /leads/:leadId
 * Full-page view replacing the drawer (drawer removed in Phase 09).
 */
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import { PageContainer } from '../../components/layout'
import { LeadDetailPage } from '../../components/leads/lead-detail/lead-detail-page'
import { api } from '../../lib/api-client'

export const Route = createFileRoute('/leads/$leadId')({
  component: LeadDetailRoute,
})

function LeadDetailRoute() {
  const { t } = useTranslation()
  const { leadId } = Route.useParams()

  const { data, isPending, isError } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: () => api.leads.get(leadId),
    staleTime: 30_000,
  })

  const lead = data?.data

  if (isError || (!isPending && !lead)) {
    return (
      <PageContainer>
        <Link
          to="/leads"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>{t('leads.backToList')}</span>
        </Link>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">{t('leads.notFound')}</h3>
          <p className="text-sm text-muted-foreground">{t('leads.notFoundDesc')}</p>
        </div>
      </PageContainer>
    )
  }

  if (!lead) {
    return (
      <PageContainer>
        <div className="max-w-6xl mx-auto w-full animate-pulse">
          <div className="h-5 w-32 bg-muted rounded mb-4" />
          <div className="h-24 bg-muted rounded-lg mb-6" />
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 space-y-4">
              <div className="h-48 bg-muted rounded-lg" />
              <div className="h-32 bg-muted rounded-lg" />
              <div className="h-28 bg-muted rounded-lg" />
            </div>
            <div className="space-y-4">
              <div className="h-32 bg-muted rounded-lg" />
              <div className="h-24 bg-muted rounded-lg" />
            </div>
          </div>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer className="pb-28">
      <LeadDetailPage lead={lead} />
    </PageContainer>
  )
}
