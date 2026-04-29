/**
 * Entity Upload Header
 * Back button + entity icon + entity name + entity-type label.
 * Extracted from entity-upload-page.tsx to keep that file under 150 LOC.
 */
import { useTranslation } from 'react-i18next'
import { ArrowLeft, User, Building2 } from 'lucide-react'
import type { PortalEntity } from '../lib/api-client'

interface EntityUploadHeaderProps {
  entity: PortalEntity
  label: string
  onBack: () => void
}

export function EntityUploadHeader({
  entity,
  label,
  onBack,
}: EntityUploadHeaderProps) {
  const { t } = useTranslation()
  const isIndividual = entity.entityType === 'individual'

  return (
    <header className="px-6 pt-6 pb-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded mb-4"
        aria-label={t('portal.entityUpload.back')}
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        {t('portal.entityUpload.back')}
      </button>

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
          <h1 className="text-lg font-semibold text-foreground truncate">
            {entity.name}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
      </div>
    </header>
  )
}
