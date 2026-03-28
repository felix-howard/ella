import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { pdf } from '@react-pdf/renderer'
import { Loader2, Check, Globe } from 'lucide-react'
import { CURRENT_TERMS_VERSION } from '@ella/shared'
import { TERMS_CONTENT, type TermsLanguage } from './terms-content'
import { TermsPDFDocument } from './terms-pdf-document'
import { SignaturePad } from './signature-pad'
import { useAcceptTerms } from './use-terms'
import { toast } from '../../stores/toast-store'

interface TermsModalProps {
  staffName: string
  onAccepted: () => void
}

export function TermsModal({ staffName, onAccepted }: TermsModalProps) {
  const { t } = useTranslation()
  const [language, setLanguage] = useState<TermsLanguage>('VI')
  const [agreed, setAgreed] = useState(false)
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const acceptMutation = useAcceptTerms()
  const content = TERMS_CONTENT[language]

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'EN' ? 'VI' : 'EN'))
  }

  const canSubmit = agreed && signatureDataUrl && !isSubmitting && !acceptMutation.isPending

  const handleSubmit = useCallback(async () => {
    if (!signatureDataUrl) return

    setIsSubmitting(true)

    try {
      const signedAt = new Date()
      const pdfDoc = (
        <TermsPDFDocument
          language={language}
          signatureDataUrl={signatureDataUrl}
          staffName={staffName}
          signedAt={signedAt}
        />
      )

      const blob = await pdf(pdfDoc).toBlob()
      const arrayBuffer = await blob.arrayBuffer()

      // Validate PDF size (max 10MB) before base64 encoding
      if (arrayBuffer.byteLength > 10_000_000) {
        toast.error(t('terms.pdfTooLarge', 'Generated PDF is too large. Please try again.'))
        return
      }

      const pdfBase64 = btoa(
        Array.from(new Uint8Array(arrayBuffer), (byte) => String.fromCharCode(byte)).join('')
      )

      await acceptMutation.mutateAsync({
        version: CURRENT_TERMS_VERSION,
        pdfBase64,
        language,
      })

      toast.success(t('terms.acceptSuccess', 'Terms accepted successfully'))
      onAccepted()
    } catch (error) {
      console.error('[TermsModal] Submit failed:', error)
      toast.error(t('terms.acceptError', 'Failed to submit. Please try again.'))
    } finally {
      setIsSubmitting(false)
    }
  }, [signatureDataUrl, language, staffName, acceptMutation, onAccepted, t])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="w-full max-w-3xl mx-4 bg-card rounded-xl shadow-2xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{content.title}</h1>
            <p className="text-sm text-muted-foreground">
              {t('terms.version', 'Version')}: {content.version}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleLanguage}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-border rounded-md hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            <Globe className="w-4 h-4" />
            {language === 'EN' ? 'Tiếng Việt' : 'English'}
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="text-sm text-muted-foreground mb-4">
            {t('terms.effectiveDate', 'Effective Date')}: {content.effectiveDate}
          </p>

          {content.sections.map((section, idx) => (
            <div key={idx} className="mb-6">
              <h2 className="font-semibold text-foreground mb-2">{section.heading}</h2>
              {section.paragraphs.map((para, pIdx) => (
                <p key={pIdx} className="text-sm text-foreground/80 mb-2 leading-relaxed">
                  {para}
                </p>
              ))}
            </div>
          ))}

          {/* Agreement Checkbox */}
          <div className="flex items-start gap-3 py-4 border-t border-border">
            <input
              type="checkbox"
              id="agree-terms"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={isSubmitting}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            />
            <label
              htmlFor="agree-terms"
              className="text-sm text-foreground cursor-pointer leading-relaxed"
            >
              {content.acknowledgment}
            </label>
          </div>

          {/* Signature Pad */}
          <div className="py-4">
            <h3 className="font-medium text-foreground mb-3">
              {t('terms.signature', 'Your Signature')}
            </h3>
            <SignaturePad
              onSignatureChange={setSignatureDataUrl}
              disabled={isSubmitting}
            />
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
                {t('terms.submitting', 'Submitting...')}
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {t('terms.acceptAndContinue', 'Accept and Continue')}
              </>
            )}
          </button>
          <p className="text-xs text-muted-foreground text-center mt-3">
            {t('terms.submitHint', 'By clicking Accept, you agree to the terms above and your signature will be recorded.')}
          </p>
        </div>
      </div>
    </div>
  )
}
