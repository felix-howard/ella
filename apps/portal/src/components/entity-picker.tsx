/**
 * Entity Picker Component
 * Shows entity selection for multi-entity clients (e.g., individual + business)
 * Mobile-first design with large touch targets
 */
import { useTranslation } from 'react-i18next'
import { User, Building2 } from 'lucide-react'
import type { GroupEntity } from '../lib/api-client'

interface EntityPickerProps {
  entities: GroupEntity[]
  currentToken: string
  onSelect: (token: string) => void
}

export function EntityPicker({ entities, currentToken, onSelect }: EntityPickerProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-4 px-6 py-8">
      <h2 className="text-lg font-semibold text-foreground text-center">
        {t('portal.entityPicker.title')}
      </h2>
      <p className="text-sm text-muted-foreground text-center mb-2">
        {t('portal.entityPicker.subtitle')}
      </p>

      <div className="flex flex-col gap-3">
        {entities.map((entity) => {
          const isCurrent = entity.token === currentToken
          return (
            <button
              key={entity.id}
              onClick={() => onSelect(entity.token)}
              className={`flex items-center gap-4 p-5 border rounded-2xl transition-colors text-left ${
                isCurrent
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card hover:bg-accent/50 active:bg-accent'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                isCurrent ? 'bg-primary/20' : 'bg-primary/10'
              }`}>
                {entity.clientType === 'BUSINESS' ? (
                  <Building2 className="w-6 h-6 text-primary" />
                ) : (
                  <User className="w-6 h-6 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-base font-medium text-foreground block truncate">
                  {entity.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {entity.clientType === 'BUSINESS'
                    ? t('portal.entityPicker.business')
                    : t('portal.entityPicker.personal')}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
