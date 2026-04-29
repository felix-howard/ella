/**
 * "Send NDA" action button. Click opens the per-recipient NDA editor modal
 * where staff can customize content before sending. Disabled reasons:
 *   - `pendingSent`: an outstanding SENT NDA invite still active
 *   - `activeEngagement`: a SIGNED NDA whose deposit is PENDING/PAID
 *   - `noPhone`: recipient has no phone number — SMS delivery would fail
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Send } from 'lucide-react'
import { NdaEditorModal } from './nda-editor-modal'
import { NdaPdfPreviewModal } from './nda-pdf-preview-modal'
import type { NdaAgreement } from '../../lib/api-client'
import type { EntityRef, Recipient } from './types'

type DisabledReason = 'pendingSent' | 'activeEngagement' | 'noPhone' | 'notAdmin'

interface Props {
  entity: EntityRef
  recipient: Recipient
  ndas: NdaAgreement[]
  /** Override computed disabled state — used for role-based UI gating (server is source of truth). */
  forceDisabledReason?: 'notAdmin'
}

function computeDisabledReason(
  recipient: Recipient,
  ndas: NdaAgreement[],
): DisabledReason | null {
  if (!recipient.phone || !recipient.phone.trim()) return 'noPhone'
  for (const n of ndas) {
    if (n.status === 'SENT' && n.isActive) return 'pendingSent'
    if (n.status === 'SIGNED' && (n.depositStatus === 'PENDING' || n.depositStatus === 'PAID')) {
      return 'activeEngagement'
    }
  }
  return null
}

export function SendNdaButton({ entity, recipient, ndas, forceDisabledReason }: Props) {
  const { t } = useTranslation()
  const [editorOpen, setEditorOpen] = useState(false)
  // `previewHtml` doubles as preview-modal open flag and the HTML to render.
  // Editor stays mounted underneath while the preview is open.
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)

  const disabledReason = useMemo(
    () => forceDisabledReason ?? computeDisabledReason(recipient, ndas),
    [forceDisabledReason, recipient, ndas],
  )
  const disabled = disabledReason !== null

  const tooltip = disabledReason ? t(`nda.send.disabled.${disabledReason}`) : undefined

  return (
    <>
      <button
        type="button"
        onClick={() => setEditorOpen(true)}
        disabled={disabled}
        title={tooltip}
        className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Send className="w-4 h-4" />
        {t('nda.send.button')}
      </button>

      {editorOpen && (
        <NdaEditorModal
          onClose={() => setEditorOpen(false)}
          entity={entity}
          recipient={recipient}
          onPreviewClick={setPreviewHtml}
        />
      )}

      <NdaPdfPreviewModal
        open={previewHtml !== null}
        entity={entity}
        contentHtml={previewHtml ?? ''}
        onClose={() => setPreviewHtml(null)}
      />
    </>
  )
}
