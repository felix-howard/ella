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

export function EntityPickerPage({ token, clientName, taxYear, entities }: EntityPickerPageProps) {
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

      <main className="mx-auto w-full max-w-4xl flex-1">
        <section className="rounded-[1.5rem] border border-white/80 bg-white/65 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.07)] backdrop-blur-sm sm:rounded-[2rem] sm:p-6 lg:p-8">
          <div className="max-w-3xl">
            <p className="mb-3 inline-flex rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary sm:text-xs">
              {t('portal.entityPicker.kicker')}
            </p>
            <h2 className="text-xl font-semibold leading-tight text-foreground sm:text-2xl">
              {t('portal.entityPicker.heading')}
            </h2>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t('portal.entityPicker.helpText')}
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4">
            {entities.map((entity) => (
              <EntityTile
                key={entity.caseId}
                entity={entity}
                onSelect={() => handleSelect(entity.caseId)}
              />
            ))}
          </div>
        </section>
      </main>

      <footer className="px-6 py-6 mt-auto text-center">
        <p className="text-sm font-medium text-muted-foreground">Ella Tax Document System</p>
      </footer>
    </div>
  )
}
