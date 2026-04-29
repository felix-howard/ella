/**
 * "Send NDA" action button. Click opens the per-lead NDA editor modal where
 * staff can customize content before sending. Disabled when an active
 * engagement exists: a SENT NDA (outstanding invite) or a SIGNED NDA whose
 * deposit is still PENDING/PAID (active client engagement).
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Send } from 'lucide-react'
import { NdaEditorModal } from './nda-editor-modal'
import { NdaPdfPreviewModal } from './nda-pdf-preview-modal'
import type { Lead, NdaAgreement } from '../../../lib/api-client'

interface Props {
  lead: Pick<Lead, 'id' | 'firstName' | 'lastName' | 'phone'>
  ndas: NdaAgreement[]
}

function computeDisabledReason(ndas: NdaAgreement[]): 'pendingSent' | 'activeEngagement' | null {
  for (const n of ndas) {
    if (n.status === 'SENT' && n.isActive) return 'pendingSent'
    if (n.status === 'SIGNED' && (n.depositStatus === 'PENDING' || n.depositStatus === 'PAID')) {
      return 'activeEngagement'
    }
  }
  return null
}

export function SendNdaButton({ lead, ndas }: Props) {
  const { t } = useTranslation()
  const [editorOpen, setEditorOpen] = useState(false)
  // `previewHtml` doubles as preview-modal open flag and the HTML to render.
  // Editor stays mounted underneath while the preview is open.
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)

  const disabledReason = useMemo(() => computeDisabledReason(ndas), [ndas])
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
          lead={lead}
          onPreviewClick={setPreviewHtml}
        />
      )}

      <NdaPdfPreviewModal
        open={previewHtml !== null}
        leadId={lead.id}
        contentHtml={previewHtml ?? ''}
        onClose={() => setPreviewHtml(null)}
      />
    </>
  )
}
