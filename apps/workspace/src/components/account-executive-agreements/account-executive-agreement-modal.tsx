import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Check } from 'lucide-react'
import {
  ACCOUNT_EXECUTIVE_AGREEMENT_CONTENT,
  fillAccountExecutiveAgreementText,
} from '@ella/shared'
import { SignaturePad } from '../terms/signature-pad'
import { useAcceptAccountExecutiveAgreement } from './use-account-executive-agreements'
import { toast } from '../../stores/toast-store'

interface AccountExecutiveAgreementModalProps {
  companyName: string
  signerName: string
  version: string
  onStatusRefresh: () => void
}

function formatToday(): string {
  return new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function AccountExecutiveAgreementModal({
  companyName,
  signerName,
  version,
  onStatusRefresh,
}: AccountExecutiveAgreementModalProps) {
  const { t } = useTranslation()
  const [agreed, setAgreed] = useState(false)
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const acceptMutation = useAcceptAccountExecutiveAgreement()
  const content = ACCOUNT_EXECUTIVE_AGREEMENT_CONTENT

  const fill = { companyName, signerName, date: formatToday() }
  const canSubmit = agreed && !!signatureDataUrl && !isSubmitting && !acceptMutation.isPending

  const handleSubmit = useCallback(async () => {
    if (!signatureDataUrl) return
    setIsSubmitting(true)
    try {
      await acceptMutation.mutateAsync({ version, signaturePngDataUrl: signatureDataUrl })
      toast.success(
        t('accountExecutiveAgreement.acceptSuccess', 'Agreement signed successfully'),
      )
      onStatusRefresh()
    } catch (error) {
      console.error('[AccountExecutiveAgreementModal] Submit failed:', error)
      toast.error(
        t('accountExecutiveAgreement.acceptError', 'Failed to submit. Please try again.'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }, [signatureDataUrl, version, acceptMutation, onStatusRefresh, t])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="w-full max-w-3xl mx-4 bg-card rounded-xl shadow-2xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border shrink-0">
          <h1 className="text-xl font-semibold text-foreground">{content.title}</h1>
          <p className="text-sm text-muted-foreground">
            {t('accountExecutiveAgreement.version', 'Version')}: {content.version}
          </p>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="text-sm text-foreground/80 mb-6 leading-relaxed">
            {fillAccountExecutiveAgreementText(content.intro, fill)}
          </p>

          {content.sections.map((section, idx) => (
            <div key={idx} className="mb-6">
              <h2 className="font-semibold text-foreground mb-2">{section.heading}</h2>
              {section.paragraphs.map((para, pIdx) => (
                <p
                  key={pIdx}
                  className={`text-sm text-foreground/80 mb-1.5 leading-relaxed ${
                    para.startsWith('•') ? 'pl-4' : ''
                  }`}
                >
                  {fillAccountExecutiveAgreementText(para, fill)}
                </p>
              ))}
            </div>
          ))}

          {/* Agreement Checkbox */}
          <div className="flex items-start gap-3 py-4 border-t border-border">
            <input
              type="checkbox"
              id="agree-account-executive-agreement"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={isSubmitting}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            />
            <label
              htmlFor="agree-account-executive-agreement"
              className="text-sm text-foreground cursor-pointer leading-relaxed"
            >
              {t(
                'accountExecutiveAgreement.acknowledgment',
                'I have read, understood, and agree to this Account Executive Agreement.',
              )}
            </label>
          </div>

          {/* Signature Pad */}
          <div className="py-4">
            <h3 className="font-medium text-foreground mb-3">
              {t('accountExecutiveAgreement.signature', 'Your Signature')}
            </h3>
            <SignaturePad onSignatureChange={setSignatureDataUrl} disabled={isSubmitting} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('accountExecutiveAgreement.submitting', 'Submitting...')}
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {t('accountExecutiveAgreement.acceptAndContinue', 'Accept and Continue')}
              </>
            )}
          </button>
          <p className="text-xs text-muted-foreground text-center mt-3">
            {t(
              'accountExecutiveAgreement.submitHint',
              'By clicking Accept, you agree to the agreement above and your signature will be recorded.',
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
