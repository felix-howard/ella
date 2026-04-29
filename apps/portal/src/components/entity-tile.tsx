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
  const { t, i18n } = useTranslation()
  const lang: 'vi' | 'en' = i18n.language === 'en' ? 'en' : 'vi'

  const label = entityTypeLabel(entity, lang)
  const isIndividual = entity.entityType === 'individual'

  let countLine: string
  if (entity.uploadCount > 0) {
    countLine = t('portal.entityPicker.uploadCount', { count: entity.uploadCount })
  } else if (!entity.hasChecklist) {
    countLine = t('portal.entityPicker.empty')
  } else {
    countLine = t('portal.entityPicker.uploadCount', { count: 0 })
  }

  const showMissing =
    entity.hasChecklist &&
    typeof entity.missingCount === 'number' &&
    entity.missingCount > 0

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
          <p className="text-xs text-muted-foreground mt-1">
            {countLine}
            {showMissing && (
              <span className="text-warning">
                {' • '}
                {t('portal.entityPicker.missingCount', { count: entity.missingCount })}
              </span>
            )}
          </p>
        </div>
      </div>
    </button>
  )
}
