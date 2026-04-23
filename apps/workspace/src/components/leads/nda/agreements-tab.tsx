/**
 * Top-level content for the "Agreements" tab in the lead detail drawer.
 * Composes SendNdaButton + NdaList and owns the list query so the button
 * can use the same data to compute its disabled state.
 */
import { useTranslation } from 'react-i18next'
import { SendNdaButton } from './send-nda-button'
import { NdaList } from './nda-list'
import { useNdaList } from './use-nda-mutations'
import type { Lead } from '../../../lib/api-client'

interface Props {
  lead: Pick<Lead, 'id' | 'firstName' | 'lastName' | 'phone'>
  enabled: boolean
}

export function AgreementsTab({ lead, enabled }: Props) {
  const { t } = useTranslation()
  const query = useNdaList(lead.id, enabled)
  const ndas = query.data?.data ?? []

  return (
    <section className="rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{t('nda.tabTitle')}</h3>
        <SendNdaButton lead={lead} ndas={ndas} />
      </div>
      <div className="p-4">
        <NdaList
          leadId={lead.id}
          ndas={ndas}
          isLoading={query.isLoading}
          isError={query.isError}
        />
      </div>
    </section>
  )
}
