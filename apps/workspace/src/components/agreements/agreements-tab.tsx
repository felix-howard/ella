/**
 * Top-level content for the "Agreements" section on a Lead or Client detail
 * page. Composes SendAgreementButton + NdaList and owns the list query so the
 * button can compute its disabled state from the same data.
 */
import { useTranslation } from 'react-i18next'
import { SendAgreementButton } from './send-agreement-button'
import { NdaList } from './agreement-list'
import { useAgreementsList } from './use-agreement-mutations'
import { CardSection } from '../shared/card-section'
import type { EntityRef, Recipient } from './types'

interface Props {
  entity: EntityRef
  recipient: Recipient
  enabled: boolean
  /** Whether the current user can send agreements. Defaults to true for backwards compat with Lead callsite. */
  canSend?: boolean
}

export function AgreementsTab({ entity, recipient, enabled, canSend = true }: Props) {
  const { t } = useTranslation()
  const query = useAgreementsList(entity, enabled)
  const agreements = query.data?.data ?? []

  return (
    <CardSection
      title={t('nda.tabTitle')}
      action={
        <SendAgreementButton
          entity={entity}
          recipient={recipient}
          agreements={agreements}
          forceDisabledReason={canSend ? undefined : 'notAdmin'}
        />
      }
    >
      <NdaList
        entity={entity}
        ndas={agreements}
        isLoading={query.isLoading}
        isError={query.isError}
      />
    </CardSection>
  )
}
