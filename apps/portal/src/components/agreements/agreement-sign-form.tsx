/**
 * Signature capture + typed name + agree checkbox.
 * Guards the submit button: only enabled when parent opened the gate
 * (`canSubmit=true` after scroll-to-bottom), signature is drawn, full name +
 * title meet length rules, and the agree checkbox is checked.
 */
import { useRef, useState } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { useTranslation } from 'react-i18next'
import { Check, Eraser, Loader2, PenLine } from 'lucide-react'
import { Button, Input } from '@ella/ui'
import type { AgreementFirmSnapshot, AgreementClientType } from '../../lib/api-client'

export interface AgreementSignSubmission {
  signerName: string
  signerTitle: string
  signaturePngDataUrl: string
  agreementChecked: true
}

interface AgreementSignFormProps {
  canSubmit: boolean
  submitting: boolean
  onSubmit: (payload: AgreementSignSubmission) => void
  /** When provided (v2), the form shows the firm's pre-signed signature image. */
  firmSnapshot?: AgreementFirmSnapshot | null
  /** Passed by the page for future client-type-specific copy. */
  clientType?: AgreementClientType | null
}

const NAME_MIN = 2
const NAME_MAX = 120
const TITLE_MIN = 2
const TITLE_MAX = 80

export function AgreementSignForm({
  canSubmit,
  submitting,
  onSubmit,
  firmSnapshot,
}: AgreementSignFormProps) {
  const { t } = useTranslation()
  const sigRef = useRef<SignatureCanvas>(null)
  const [signerName, setSignerName] = useState('')
  const [signerTitle, setSignerTitle] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [hasStroke, setHasStroke] = useState(false)

  const trimmedName = signerName.trim()
  const trimmedTitle = signerTitle.trim()
  const nameValid = trimmedName.length >= NAME_MIN && trimmedName.length <= NAME_MAX
  const titleValid = trimmedTitle.length >= TITLE_MIN && trimmedTitle.length <= TITLE_MAX
  const formReady = canSubmit && hasStroke && nameValid && titleValid && agreed && !submitting

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
    // react-signature-canvas@1.1.0-alpha.2 removed getTrimmedCanvas(); calling
    // it throws and kills the click silently. Use toDataURL() directly.
    const dataUrl = canvas.toDataURL('image/png')
    onSubmit({
      signerName: trimmedName,
      signerTitle: trimmedTitle,
      signaturePngDataUrl: dataUrl,
      agreementChecked: true,
    })
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-card space-y-5 sm:p-6 lg:p-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-primary-dark">
          <PenLine className="w-3.5 h-3.5" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-semibold text-foreground lg:text-base">
          {t('nda.signFormTitle')}
        </h2>
      </div>

      {firmSnapshot?.signaturePresignedUrl && (
        <div className="rounded-lg border border-border bg-muted/40 p-3.5 shadow-subtle">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            {t('nda.firmAlreadySigned')}
          </p>
          <div className="flex items-end gap-3">
            <img
              src={firmSnapshot.signaturePresignedUrl}
              alt={firmSnapshot.signerName || 'Firm signature'}
              className="h-16 w-auto bg-white rounded-md border border-border"
            />
            <div className="text-xs text-foreground/80 leading-snug pb-1">
              <div className="font-semibold text-foreground">{firmSnapshot.signerName}</div>
              {firmSnapshot.signerTitle && <div>{firmSnapshot.signerTitle}</div>}
              {firmSnapshot.signedAt && (
                <div className="text-muted-foreground mt-0.5">{firmSnapshot.signedAt}</div>
              )}
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          {t('nda.signatureLabel')}
        </label>
        <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-border bg-white shadow-subtle transition-colors focus-within:border-primary/50">
          <SignatureCanvas
            ref={sigRef}
            penColor="#111827"
            backgroundColor="#ffffff"
            clearOnResize={false}
            onEnd={handleStrokeEnd}
            canvasProps={{
              className: 'block w-full h-36 sm:h-44 lg:h-36 touch-none',
              'aria-label': t('nda.signatureLabel'),
            }}
          />
          <button
            type="button"
            onClick={handleClear}
            disabled={submitting}
            className="absolute top-2 right-2 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-card/90 border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 backdrop-blur-sm"
          >
            <Eraser className="w-3.5 h-3.5" />
            {t('nda.clearSignature')}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t('nda.signatureHint')}</p>
      </div>

      <div>
        <label
          className="block text-sm font-medium text-foreground mb-1.5"
          htmlFor="nda-signer-name"
        >
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
          required
          aria-required="true"
          className="focus:ring-1 focus:ring-primary/30"
        />
      </div>

      <div>
        <label
          className="block text-sm font-medium text-foreground mb-1.5"
          htmlFor="nda-signer-title"
        >
          {t('nda.signerTitleLabel')}
        </label>
        <Input
          id="nda-signer-title"
          value={signerTitle}
          onChange={(e) => setSignerTitle(e.target.value)}
          placeholder={t('nda.signerTitlePlaceholder')}
          maxLength={TITLE_MAX}
          disabled={submitting}
          autoComplete="organization-title"
          required
          aria-required="true"
          className="focus:ring-1 focus:ring-primary/30"
        />
      </div>

      <label
        className={`flex items-start gap-3 rounded-lg border p-3.5 transition-colors ${
          agreed
            ? 'border-primary/40 bg-primary-light/40'
            : 'border-border bg-muted/30 hover:bg-muted/50'
        } ${canSubmit && !submitting ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'}`}
      >
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          disabled={submitting || !canSubmit}
          className="mt-0.5 h-4 w-4 accent-primary shrink-0"
        />
        <span className="text-sm text-foreground leading-snug">
          {canSubmit ? t('nda.agreeLabel') : t('nda.scrollFirstHint')}
        </span>
      </label>

      <Button
        onClick={handleSubmit}
        disabled={!formReady}
        size="lg"
        className="w-full gap-2 shadow-md"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('nda.submitting')}
          </>
        ) : (
          <>
            <Check className="w-4 h-4" />
            {t('nda.submit')}
          </>
        )}
      </Button>
    </section>
  )
}
