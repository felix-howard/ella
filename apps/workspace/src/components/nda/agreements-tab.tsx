/**
 * Top-level content for the "Agreements" section on a Lead or Client detail
 * page. Composes SendNdaButton + NdaList and owns the list query so the button
 * uses the same data to compute its disabled state.
 */
import { useTranslation } from 'react-i18next'
import { SendNdaButton } from './send-nda-button'
import { NdaList } from './nda-list'
import { useNdaList } from './use-nda-mutations'
import { CardSection } from '../shared/card-section'
import type { EntityRef, Recipient } from './types'

interface Props {
  entity: EntityRef
  recipient: Recipient
  enabled: boolean
  /** Whether the current user can send NDAs. Defaults to true for backwards compat with Lead callsite. */
  canSend?: boolean
}

export function AgreementsTab({ entity, recipient, enabled, canSend = true }: Props) {
  const { t } = useTranslation()
  const query = useNdaList(entity, enabled)
  const ndas = query.data?.data ?? []

  return (
    <CardSection
      title={t('nda.tabTitle')}
      action={
        <SendNdaButton
          entity={entity}
          recipient={recipient}
          ndas={ndas}
          forceDisabledReason={canSend ? undefined : 'notAdmin'}
        />
      }
    >
      <NdaList
        entity={entity}
        ndas={ndas}
        isLoading={query.isLoading}
        isError={query.isError}
      />
    </CardSection>
  )
}
