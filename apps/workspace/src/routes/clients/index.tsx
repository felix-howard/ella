/**
 * Client List Page - View all clients with search, managed-by filter, and attention chips
 */

import { useState, useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Search, AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@ella/ui'
import { PageContainer } from '../../components/layout'
import { ClientListTable } from '../../components/clients'
import { CustomSelect } from '../../components/ui/custom-select'
import { useDebouncedValue } from '../../hooks'
import { useOrgRole } from '../../hooks/use-org-role'
import { UI_TEXT } from '../../lib/constants'
import { api } from '../../lib/api-client'

export const Route = createFileRoute('/clients/')({
  component: ClientListPage,
})

function ClientListPage() {
  const { t } = useTranslation()
  const { isAdmin, staffId } = useOrgRole()
  const [searchQuery, setSearchQuery] = useState('')
  const [managedById, setManagedById] = useState<string | undefined>(undefined)
  const [attention, setAttention] = useState<string | undefined>(undefined)

  // Debounce search query for server-side search (300ms delay)
  const [debouncedSearch, isSearchPending] = useDebouncedValue(searchQuery, 300)

  // Fetch team members for "Managed By" dropdown (admin only)
  const { data: teamData } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => api.team.listMembers(),
    enabled: isAdmin,
    staleTime: 60000,
  })
  const teamMembers = teamData?.data ?? []

  // Fetch clients from API
  const {
    data: clientsResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['clients', {
      search: debouncedSearch || undefined,
      managedById,
      attention,
    }],
    queryFn: () => api.clients.list({
      limit: 100,
      search: debouncedSearch || undefined,
      managedById,
      attention: attention as 'newUploads' | 'needsVerification' | 'stale' | 'readyForEntry' | undefined,
    }),
    placeholderData: keepPreviousData,
  })

  const clients = clientsResponse?.data ?? []
  const attentionSummary = clientsResponse?.attentionSummary

  const { clients: clientsText } = UI_TEXT

  const attentionChips = [
    { key: 'newUploads', label: t('clients.newUploads'), count: attentionSummary?.newUploads ?? 0 },
    { key: 'needsVerification', label: t('clients.needsVerification'), count: attentionSummary?.needsVerification ?? 0 },
    { key: 'stale', label: t('clients.stale'), count: attentionSummary?.stale ?? 0 },
    { key: 'readyForEntry', label: t('clients.readyForEntry'), count: attentionSummary?.readyForEntry ?? 0 },
  ]

  // Build managed-by dropdown options
  const managedByOptions = useMemo(() => {
    const opts = []
    if (staffId) opts.push({ value: staffId, label: t('clients.me') })
    for (const m of teamMembers.filter(m => m.id !== staffId && m.isActive)) {
      opts.push({ value: m.id, label: m.name })
    }
    return opts
  }, [teamMembers, staffId, t])

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{clientsText.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {clients.length} {clientsText.count}
          </p>
        </div>

        <Link
          to="/clients/new"
          className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-full font-medium hover:bg-primary-dark transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" aria-hidden="true" />
          <span>{clientsText.newClient}</span>
        </Link>
      </div>

      {/* Controls Bar - single row: Search + Managed By + Attention Chips */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          {isSearchPending ? (
            <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" aria-hidden="true" />
          ) : (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          )}
          <input
            type="text"
            placeholder={clientsText.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-full border-none bg-card shadow-sm text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
          />
        </div>

        {/* Managed By dropdown (admin only) */}
        {isAdmin && (
          <CustomSelect
            value={managedById ?? ''}
            onChange={(val) => setManagedById(val || undefined)}
            options={managedByOptions}
            placeholder={t('clients.allMembers')}
            className="w-[160px]"
          />
        )}

        {/* Attention chips */}
        {attentionChips
          .filter(chip => chip.count > 0)
          .map(chip => (
            <button
              key={chip.key}
              onClick={() => setAttention(attention === chip.key ? undefined : chip.key)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                attention === chip.key
                  ? 'bg-primary text-white'
                  : 'bg-card text-muted-foreground hover:bg-muted shadow-sm'
              )}
            >
              {chip.label}
              <span className={cn(
                'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold',
                attention === chip.key
                  ? 'bg-white/20 text-white'
                  : 'bg-muted text-muted-foreground'
              )}>
                {chip.count}
              </span>
            </button>
          ))
        }
      </div>

      {/* Content */}
      {isLoading ? (
        <ClientListTable clients={[]} isLoading isAdmin={isAdmin} />
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">{t('clients.errorLoadingList')}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {error instanceof Error ? error.message : t('common.error')}
          </p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {t('common.retry')}
          </button>
        </div>
      ) : (
        <ClientListTable clients={clients} isAdmin={isAdmin} />
      )}
    </PageContainer>
  )
}
