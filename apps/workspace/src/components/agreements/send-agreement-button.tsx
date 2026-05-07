/**
 * "Send Agreement" action button. Click opens the 3-step send wizard:
 *   1. Type picker (NDA / Engagement Letter / Service Agreement / Custom)
 *   2. Template picker (NDA auto-skips with built-in template)
 *   3. Content editor + metadata (title, deposit, internal note)
 *
 * Top-level button is type-agnostic — only `noPhone` and `notAdmin` reasons
 * gate it. Type-specific gates (NDA active-engagement / pending invite) are
 * surfaced inside the wizard's Step 1 type picker, since they only apply when
 * the user actually picks NDA. Other types are always sendable in parallel.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Send } from 'lucide-react'
import { AgreementSendWizard } from './agreement-send-wizard'
import type { Agreement } from '../../lib/api-client'
import type { EntityRef, Recipient } from './types'

type DisabledReason = 'noPhone' | 'notAdmin'

interface Props {
  entity: EntityRef
  recipient: Recipient
  agreements: Agreement[]
  /** Override computed disabled state — used for role-based UI gating (server is source of truth). */
  forceDisabledReason?: 'notAdmin'
}

function computeDisabledReason(recipient: Recipient): DisabledReason | null {
  if (!recipient.phone || !recipient.phone.trim()) return 'noPhone'
  return null
}

export function SendAgreementButton({ entity, recipient, agreements, forceDisabledReason }: Props) {
  const { t } = useTranslation()
  const [wizardOpen, setWizardOpen] = useState(false)

  const disabledReason = useMemo(
    () => forceDisabledReason ?? computeDisabledReason(recipient),
    [forceDisabledReason, recipient],
  )
  const disabled = disabledReason !== null

  const tooltip = disabledReason ? t(`nda.send.disabled.${disabledReason}`) : undefined

  return (
    <>
      <button
        type="button"
        onClick={() => setWizardOpen(true)}
        disabled={disabled}
        title={tooltip}
        className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Send className="w-4 h-4" />
        {t('agreements.send.button')}
      </button>

      {wizardOpen && (
        <AgreementSendWizard
          entity={entity}
          recipient={recipient}
          agreements={agreements}
          onClose={() => setWizardOpen(false)}
        />
      )}
    </>
  )
}
