/**
 * Entity Picker Page
 * Multi-entity portal landing — folder-style tile grid for picking which
 * entity (individual / business) to upload documents for.
 */
import { useTranslation } from 'react-i18next'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import type { PortalEntity } from '../lib/api-client'
import { WelcomeHeader } from './landing/welcome-header'
import { EntityTile } from './entity-tile'

interface EntityPickerPageProps {
  token: string
  clientName: string
  taxYear: number
  entities: PortalEntity[]
}

export function EntityPickerPage({
  token,
  clientName,
  taxYear,
  entities,
}: EntityPickerPageProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  // Mirror the entry point: /u/... or /upload/... so the URL stays consistent.
  const useUploadPrefix = pathname.startsWith('/upload/')

  const handleSelect = (caseId: string) => {
    if (useUploadPrefix) {
      navigate({ to: '/upload/$token/e/$caseId', params: { token, caseId } })
    } else {
      navigate({ to: '/u/$token/e/$caseId', params: { token, caseId } })
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <WelcomeHeader clientName={clientName} taxYear={taxYear} />

      <div className="px-6 py-2">
        <h2 className="text-base font-semibold text-foreground">
          {t('portal.entityPicker.heading')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('portal.entityPicker.helpText')}
        </p>
      </div>

      <div className="px-6 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {entities.map((entity) => (
            <EntityTile
              key={entity.caseId}
              entity={entity}
              onSelect={() => handleSelect(entity.caseId)}
            />
          ))}
        </div>
      </div>

      <footer className="px-6 py-4 mt-auto text-center">
        <p className="text-xs text-muted-foreground">Ella Tax Document System</p>
      </footer>
    </div>
  )
}
