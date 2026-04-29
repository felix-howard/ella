/**
 * Lead List Empty State - Two variants: no leads at all / filtered empty.
 */
import { useTranslation } from 'react-i18next'
import { Users, SearchX, Plus } from 'lucide-react'

interface LeadListEmptyStateProps {
  variant: 'empty' | 'filtered'
  onAddLead?: () => void
  onClearFilters?: () => void
}

export function LeadListEmptyState({ variant, onAddLead, onClearFilters }: LeadListEmptyStateProps) {
  const { t } = useTranslation()

  if (variant === 'filtered') {
    return (
      <div className="bg-card rounded-xl shadow-sm border border-border/40 p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <SearchX className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
        </div>
        <h3 className="font-medium text-foreground mb-1">
          {t('leads.noMatch', 'No leads match')}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t('leads.noMatchDesc', 'Try adjusting your search or filters.')}
        </p>
        {onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted hover:bg-muted/70 text-sm font-medium text-foreground transition-colors"
          >
            {t('leads.clearFilters', 'Clear filters')}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border/40 p-12 text-center">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mx-auto mb-4">
        <Users className="w-10 h-10 text-primary" aria-hidden="true" />
      </div>
      <h3 className="font-medium text-foreground mb-1">{t('leads.noLeads')}</h3>
      <p className="text-sm text-muted-foreground mb-4">{t('leads.noLeadsDesc')}</p>
      {onAddLead && (
        <button
          type="button"
          onClick={onAddLead}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white hover:bg-primary-dark text-sm font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          {t('leads.addFirstLead', 'Add your first lead')}
        </button>
      )}
    </div>
  )
}
