import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, KeyRound, Loader2, Plus, RefreshCw, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageContainer } from '../components/layout'
import { CompanyVaultDeleteDialog } from '../components/company-vault/company-vault-delete-dialog'
import { CompanyVaultFormModal } from '../components/company-vault/company-vault-form-modal'
import { CompanyVaultTable } from '../components/company-vault/company-vault-table'
import { useDebouncedValue } from '../hooks'
import { api, type CompanyVaultCredential, type CompanyVaultInput } from '../lib/api-client'
import { toast } from '../stores/toast-store'

export const Route = createFileRoute('/company-vault')({
  component: CompanyVaultPage,
})

function CompanyVaultPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [formCredential, setFormCredential] = useState<CompanyVaultCredential | null | undefined>(undefined)
  const [deleteCredential, setDeleteCredential] = useState<CompanyVaultCredential | null>(null)
  const [debouncedSearch, isSearchPending] = useDebouncedValue(search, 300)
  const searchParam = debouncedSearch.trim()

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
    isRefetching,
  } = useQuery({
    queryKey: ['company-vault', { search: searchParam }],
    queryFn: () => api.companyVault.list({ search: searchParam || undefined }),
    gcTime: 0,
    staleTime: 0,
    placeholderData: keepPreviousData,
  })

  useEffect(() => {
    return () => {
      queryClient.removeQueries({ queryKey: ['company-vault'] })
    }
  }, [queryClient])

  const credentials = data?.credentials ?? []
  const isSearching = isSearchPending || (isFetching && !isLoading)
  const toolCountLabel = t('companyVault.toolCount', { count: credentials.length })

  const invalidateVault = () => queryClient.invalidateQueries({ queryKey: ['company-vault'] })

  const createMutation = useMutation({
    mutationFn: (input: CompanyVaultInput) => api.companyVault.create(input),
    onSuccess: async () => {
      toast.success(t('companyVault.createSuccess'))
      setFormCredential(undefined)
      await invalidateVault()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t('companyVault.createError'))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CompanyVaultInput> }) =>
      api.companyVault.update(id, input),
    onSuccess: async () => {
      toast.success(t('companyVault.updateSuccess'))
      setFormCredential(undefined)
      await invalidateVault()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t('companyVault.updateError'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.companyVault.delete(id),
    onSuccess: async () => {
      toast.success(t('companyVault.deleteSuccess'))
      setDeleteCredential(null)
      await invalidateVault()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : t('companyVault.deleteError'))
    },
  })

  const handleSubmitCredential = (input: CompanyVaultInput) => {
    if (!formCredential) {
      createMutation.mutate(input)
      return
    }

    const updateInput = buildUpdateInput(formCredential, input)
    if (Object.keys(updateInput).length === 0) {
      setFormCredential(undefined)
      return
    }
    updateMutation.mutate({ id: formCredential.id, input: updateInput })
  }

  const handleConfirmDelete = () => {
    if (!deleteCredential) return
    deleteMutation.mutate(deleteCredential.id)
  }

  const isSavingCredential = createMutation.isPending || updateMutation.isPending

  return (
    <PageContainer>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-light">
            <KeyRound className="h-5 w-5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{t('companyVault.title')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('companyVault.subtitle')}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setFormCredential(null)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('companyVault.addCredential')}
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">{t('companyVault.searchLabel')}</span>
          {isSearching ? (
            <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : (
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          )}
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('companyVault.searchPlaceholder')}
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className="whitespace-nowrap text-sm text-muted-foreground">{toolCountLabel}</span>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isLoading || isFetching || isRefetching}
            aria-label={t('companyVault.refreshAria')}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={(isRefetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4')} aria-hidden="true" />
            <span className="hidden sm:inline">{t('common.refresh', 'Refresh')}</span>
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t('companyVault.loading')}</p>
        </div>
      )}

      {!isLoading && isError && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="mb-4 h-12 w-12 text-destructive" aria-hidden="true" />
          <h2 className="mb-2 text-lg font-medium text-foreground">{t('companyVault.loadErrorTitle')}</h2>
          <p className="mb-4 max-w-md text-sm text-muted-foreground">
            {error instanceof Error ? error.message : t('companyVault.loadErrorDescription')}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {t('common.retry', 'Retry')}
          </button>
        </div>
      )}

      {!isLoading && !isError && credentials.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
          <KeyRound className="mb-4 h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <h2 className="mb-2 text-lg font-medium text-foreground">
            {searchParam ? t('companyVault.noMatchesTitle') : t('companyVault.emptyTitle')}
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {searchParam
              ? t('companyVault.noMatchesDescription')
              : t('companyVault.emptyDescription')}
          </p>
        </div>
      )}

      {!isLoading && !isError && credentials.length > 0 && (
        <CompanyVaultTable
          credentials={credentials}
          onEdit={setFormCredential}
          onDelete={setDeleteCredential}
        />
      )}

      <CompanyVaultFormModal
        open={formCredential !== undefined}
        credential={formCredential}
        isPending={isSavingCredential}
        onClose={() => {
          if (!isSavingCredential) setFormCredential(undefined)
        }}
        onSubmit={handleSubmitCredential}
      />
      <CompanyVaultDeleteDialog
        credential={deleteCredential}
        isPending={deleteMutation.isPending}
        onClose={() => {
          if (!deleteMutation.isPending) setDeleteCredential(null)
        }}
        onConfirm={handleConfirmDelete}
      />
    </PageContainer>
  )
}

function buildUpdateInput(
  current: CompanyVaultCredential,
  next: CompanyVaultInput
): Partial<CompanyVaultInput> {
  const update: Partial<CompanyVaultInput> = {}
  if (next.toolName !== current.toolName) update.toolName = next.toolName
  if (next.username !== current.username) update.username = next.username
  if (next.password !== current.password) update.password = next.password
  if (next.note !== current.note) update.note = next.note
  return update
}
