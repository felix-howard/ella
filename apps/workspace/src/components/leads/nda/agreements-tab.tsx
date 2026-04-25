/**
 * Top-level content for the "Agreements" tab in the lead detail drawer.
 * Composes SendNdaButton + NdaList and owns the list query so the button
 * can use the same data to compute its disabled state.
 */
import { useTranslation } from 'react-i18next'
import { SendNdaButton } from './send-nda-button'
import { NdaList } from './nda-list'
import { useNdaList } from './use-nda-mutations'
import { CardSection } from '../../shared/card-section'
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
    <CardSection
      title={t('nda.tabTitle')}
      action={<SendNdaButton lead={lead} ndas={ndas} />}
    >
      <NdaList
        leadId={lead.id}
        ndas={ndas}
        isLoading={query.isLoading}
        isError={query.isError}
      />
    </CardSection>
  )
}
