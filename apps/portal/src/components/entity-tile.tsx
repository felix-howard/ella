/**
 * Entity Tile Component
 * Single tappable tile in the multi-entity portal picker grid.
 */
import { useTranslation } from 'react-i18next'
import { User, Building2 } from 'lucide-react'
import type { PortalEntity } from '../lib/api-client'
import { entityTypeLabel } from '../lib/entity-type-label'

interface EntityTileProps {
  entity: PortalEntity
  onSelect: () => void
}

export function EntityTile({ entity, onSelect }: EntityTileProps) {
  const { t } = useTranslation()

  const label = entityTypeLabel(entity, t)
  const isIndividual = entity.entityType === 'individual'

  // Checklist-based "missing" count is intentionally hidden — checklist
  // wiring isn't trustworthy yet and the warning misleads clients.
  const countLine =
    entity.uploadCount > 0
      ? t('portal.entityPicker.uploadCount', { count: entity.uploadCount })
      : t('portal.entityPicker.empty')

  return (
    <button
      type="button"
      onClick={onSelect}
      className="text-left rounded-2xl border border-border bg-card p-4 hover:border-primary hover:shadow-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          {isIndividual ? (
            <User className="w-6 h-6 text-primary" />
          ) : (
            <Building2 className="w-6 h-6 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{entity.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          <p className="text-xs text-muted-foreground mt-1">{countLine}</p>
        </div>
      </div>
    </button>
  )
}
