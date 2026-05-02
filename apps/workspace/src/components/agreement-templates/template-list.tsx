/**
 * Templates list with type filter + show-archived toggle. Owns the create/edit
 * modal because edit needs the row's template object — lifting the modal here
 * keeps row components stateless.
 *
 * Active vs. archived is filtered client-side from a single query that always
 * passes `includeArchived: true`, so toggling does not refetch.
 */
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Plus } from 'lucide-react'
import { api } from '../../lib/api-client'
import type {
  AgreementTemplate,
  AgreementTemplateType,
} from '../../lib/api-client'
import { TemplateRow } from './template-row'
import { TemplateFormModal } from './template-form-modal'

type TypeFilter = 'ALL' | AgreementTemplateType

const TYPE_OPTIONS: TypeFilter[] = [
  'ALL',
  'NDA',
  'ENGAGEMENT_LETTER',
  'SERVICE_AGREEMENT',
]

export function TemplateList() {
  const { t } = useTranslation()
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL')
  const [showArchived, setShowArchived] = useState(false)
  const [editing, setEditing] = useState<AgreementTemplate | null>(null)
  const [creating, setCreating] = useState(false)

  // Always fetch with includeArchived so toggling is client-side instant.
  const { data, isLoading, isError } = useQuery({
    queryKey: [
      'agreement-templates',
      'list',
      typeFilter,
      'all',
    ] as const,
    queryFn: () =>
      api.agreementTemplates.list({
        type: typeFilter === 'ALL' ? undefined : typeFilter,
        includeArchived: true,
      }),
    staleTime: 30_000,
  })

  const filtered = useMemo(() => {
    const items = data?.data ?? []
    return showArchived ? items : items.filter((tpl) => !tpl.isArchived)
  }, [data?.data, showArchived])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'ALL'
                  ? t('agreementTemplates.filterAll')
                  : t(`agreements.type.${opt}`)}
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            {t('agreementTemplates.showArchived')}
          </label>
        </div>

        <button
          type="button"
          onClick={() => setCreating(true)}
          className="px-3 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('agreementTemplates.createCta')}
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card">
        {isLoading && (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        )}

        {isError && !isLoading && (
          <div className="p-4 text-sm text-destructive">
            {t('agreementTemplates.loadError')}
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {(data?.data ?? []).length > 0 && !showArchived
              ? t('agreementTemplates.emptyAllArchived')
              : t('agreementTemplates.empty')}
          </div>
        )}

        {!isLoading && !isError && filtered.length > 0 && (
          <div>
            {filtered.map((tpl) => (
              <TemplateRow
                key={tpl.id}
                template={tpl}
                onEdit={setEditing}
              />
            ))}
          </div>
        )}
      </div>

      {creating && (
        <TemplateFormModal template={null} onClose={() => setCreating(false)} />
      )}
      {editing && (
        <TemplateFormModal
          template={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
