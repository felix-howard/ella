/**
 * Entity Upload Header
 * Back button + entity icon + entity name + entity-type label.
 * Extracted from entity-upload-page.tsx to keep that file under 150 LOC.
 */
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Building2, User } from 'lucide-react'
import type { PortalEntity } from '../lib/api-client'

interface EntityUploadHeaderProps {
  entity: PortalEntity
  label: string
  onBack: () => void
}

export function EntityUploadHeader({ entity, label, onBack }: EntityUploadHeaderProps) {
  const { t } = useTranslation()
  const isIndividual = entity.entityType === 'individual'

  return (
    <header>
      <button
        type="button"
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 rounded-full border border-transparent px-1 py-1 text-sm font-medium text-muted-foreground transition hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:text-base"
        aria-label={t('portal.entityUpload.back')}
      >
        <ArrowLeft className="w-4 h-4 sm:h-5 sm:w-5" aria-hidden="true" />
        {t('portal.entityUpload.back')}
      </button>

      <div className="flex items-center gap-4 sm:gap-5">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/10 sm:h-20 sm:w-20"
          aria-hidden="true"
        >
          {isIndividual ? (
            <User className="h-8 w-8 text-primary sm:h-10 sm:w-10" />
          ) : (
            <Building2 className="h-8 w-8 text-primary sm:h-10 sm:w-10" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
            {entity.name}
          </h1>
          <p className="mt-1 text-base font-medium text-muted-foreground sm:text-lg">{label}</p>
        </div>
      </div>
    </header>
  )
}
