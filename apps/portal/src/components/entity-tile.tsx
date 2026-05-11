/**
 * Entity Tile Component
 * Single tappable tile in the multi-entity portal picker grid.
 */
import { useTranslation } from 'react-i18next'
import { ArrowRight, Building2, CheckCircle2, User } from 'lucide-react'
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
  const hasUploads = entity.uploadCount > 0

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] transition duration-150 hover:border-primary/25 hover:bg-primary/[0.02] hover:shadow-[0_10px_28px_rgba(15,23,42,0.07)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary active:bg-primary/[0.04] sm:p-5"
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div
          className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 ring-1 ring-primary/10 transition group-hover:bg-primary/15 group-hover:ring-primary/20 sm:h-16 sm:w-16"
          aria-hidden="true"
        >
          {isIndividual ? (
            <User className="w-7 h-7 text-primary sm:h-8 sm:w-8" />
          ) : (
            <Building2 className="w-7 h-7 text-primary sm:h-8 sm:w-8" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xl font-semibold leading-tight text-foreground sm:text-2xl">
                {entity.name}
              </p>
              <p className="mt-1 text-sm font-medium text-muted-foreground sm:text-base">{label}</p>
            </div>
            <span
              className="mt-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition group-hover:bg-primary/10 group-hover:text-primary sm:flex"
              aria-hidden="true"
            >
              <ArrowRight className="h-5 w-5" />
            </span>
          </div>

          <p className="mt-3 flex items-center gap-2 text-sm font-medium text-muted-foreground sm:text-base">
            {hasUploads && (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            )}
            <span>{countLine}</span>
          </p>
        </div>
      </div>
    </button>
  )
}
