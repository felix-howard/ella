/**
 * EntityFilterBar - Toggle buttons to filter docs by entity in unified view
 * Shows "All" + one button per entity with doc counts
 */

import { cn } from '@ella/ui'
import { useTranslation } from 'react-i18next'
import type { EntityInfo } from '../../lib/api-client'

/** Color palette for entity badges/pills — indexed by entity position */
export const ENTITY_COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800' },
  { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
  { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-200 dark:border-pink-800' },
]

export function getEntityColor(index: number) {
  return ENTITY_COLORS[index % ENTITY_COLORS.length]
}

export interface EntityFilterBarProps {
  entities: EntityInfo[]
  selectedEntityId: string | null // null = "All"
  onSelect: (entityId: string | null) => void
  totalCount: number
}

export function EntityFilterBar({ entities, selectedEntityId, onSelect, totalCount }: EntityFilterBarProps) {
  const { t } = useTranslation()
  if (entities.length <= 1) return null

  return (
    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t('filesTab.entityFilter', 'Filter by entity')}>
      {/* All button */}
      <button
        role="tab"
        aria-selected={selectedEntityId === null}
        onClick={() => onSelect(null)}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
          selectedEntityId === null
            ? 'bg-foreground text-background border-foreground'
            : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
        )}
      >
        {t('common.all', 'All')}
        <span className="text-xs opacity-70">({totalCount})</span>
      </button>

      {/* Entity buttons */}
      {entities.map((entity, idx) => {
        const color = getEntityColor(idx)
        const isSelected = selectedEntityId === entity.clientId

        return (
          <button
            key={entity.clientId}
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelect(entity.clientId)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
              isSelected
                ? `${color.bg} ${color.text} ${color.border}`
                : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
            )}
          >
            {entity.name}
            <span className="text-xs opacity-70">({entity.imageCount})</span>
          </button>
        )
      })}
    </div>
  )
}
