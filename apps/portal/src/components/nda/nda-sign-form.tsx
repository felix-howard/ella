/**
 * Signature capture + typed name + agree checkbox.
 * Guards the submit button: only enabled when parent opened the gate
 * (`canSubmit=true` after scroll-to-bottom), signature is drawn, typed name
 * meets length rules, and the agree checkbox is checked.
 */
import { useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { useTranslation } from 'react-i18next'
import { Eraser, Loader2 } from 'lucide-react'
import { Button, Input } from '@ella/ui'

export interface NdaSignSubmission {
  signerName: string
  signaturePngDataUrl: string
  agreementChecked: true
}

interface NdaSignFormProps {
  canSubmit: boolean
  submitting: boolean
  onSubmit: (payload: NdaSignSubmission) => void
}

const NAME_MIN = 2
const NAME_MAX = 120

export function NdaSignForm({ canSubmit, submitting, onSubmit }: NdaSignFormProps) {
  const { t } = useTranslation()
  const sigRef = useRef<SignatureCanvas>(null)
  const [signerName, setSignerName] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [hasStroke, setHasStroke] = useState(false)

  const trimmedName = signerName.trim()
  const nameValid = trimmedName.length >= NAME_MIN && trimmedName.length <= NAME_MAX
  const formReady = canSubmit && hasStroke && nameValid && agreed && !submitting

  const handleClear = () => {
    sigRef.current?.clear()
    setHasStroke(false)
  }

  // onEnd (pointer release) + isEmpty() check avoids a stray tap registering
  // as a valid signature on touch devices.
  const handleStrokeEnd = () => {
    const canvas = sigRef.current
    setHasStroke(Boolean(canvas && !canvas.isEmpty()))
  }

  const handleSubmit = () => {
    const canvas = sigRef.current
    if (!canvas || canvas.isEmpty()) {
      setHasStroke(false)
      return
    }
    const dataUrl = canvas.getTrimmedCanvas().toDataURL('image/png')
    onSubmit({
      signerName: trimmedName,
      signaturePngDataUrl: dataUrl,
      agreementChecked: true,
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          {t('nda.signatureLabel')}
        </label>
        <div className="relative border border-border rounded-md bg-white overflow-hidden">
          <SignatureCanvas
            ref={sigRef}
            penColor="#111827"
            backgroundColor="#ffffff"
            onEnd={handleStrokeEnd}
            canvasProps={{
              className: 'w-full h-40 touch-none',
              'aria-label': t('nda.signatureLabel'),
            }}
          />
          <button
            type="button"
            onClick={handleClear}
            disabled={submitting}
            className="absolute top-2 right-2 inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-muted/80 hover:bg-muted text-muted-foreground disabled:opacity-50"
          >
            <Eraser className="w-3.5 h-3.5" />
            {t('nda.clearSignature')}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{t('nda.signatureHint')}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="nda-signer-name">
          {t('nda.typedNameLabel')}
        </label>
        <Input
          id="nda-signer-name"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          placeholder={t('nda.typedNamePlaceholder')}
          maxLength={NAME_MAX}
          disabled={submitting}
          autoComplete="name"
        />
      </div>

      <label className="flex items-start gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          disabled={submitting || !canSubmit}
          className="mt-0.5 h-4 w-4 accent-primary"
        />
        <span className="text-sm text-foreground">
          {canSubmit ? t('nda.agreeLabel') : t('nda.scrollFirstHint')}
        </span>
      </label>

      <Button onClick={handleSubmit} disabled={!formReady} className="w-full gap-2">
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('nda.submitting')}
          </>
        ) : (
          t('nda.submit')
        )}
      </Button>
    </div>
  )
}
