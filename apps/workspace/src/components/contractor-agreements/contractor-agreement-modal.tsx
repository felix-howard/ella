import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, FileText, Loader2 } from 'lucide-react'
import { SignaturePad } from '../terms/signature-pad'
import { useAcceptContractorAgreement } from './use-contractor-agreements'
import { ContractorAgreementDocument } from './contractor-agreement-document'
import type {
  ContractorAgreementFirmSigner,
  ContractorAgreementOrganization,
} from './contractor-agreement-document-types'
import { toast } from '../../stores/toast-store'

interface ContractorAgreementModalProps {
  firmSigner?: ContractorAgreementFirmSigner | null
  organization?: ContractorAgreementOrganization
  staffName: string
  version: string
  onStatusRefresh: () => void
}

export function ContractorAgreementModal({
  firmSigner,
  organization,
  staffName,
  version,
  onStatusRefresh,
}: ContractorAgreementModalProps) {
  const { t } = useTranslation()
  const [agreed, setAgreed] = useState(false)
  const [signaturePngDataUrl, setSignaturePngDataUrl] = useState<string | null>(null)
  const acceptMutation = useAcceptContractorAgreement()

  const isSubmitting = acceptMutation.isPending
  const canSubmit = agreed && Boolean(signaturePngDataUrl) && !isSubmitting

  const handleSubmit = useCallback(async () => {
    if (!agreed || !signaturePngDataUrl) return

    try {
      await acceptMutation.mutateAsync({ version, signaturePngDataUrl })
      toast.success(t('contractorAgreement.acceptSuccess', 'Contractor agreement signed'))
      onStatusRefresh()
    } catch (error) {
      console.error('[ContractorAgreementModal] Submit failed:', error)
      const fallbackMessage = t(
        'contractorAgreement.acceptError',
        'Failed to submit. Please try again.'
      )
      toast.error(error instanceof Error ? error.message : fallbackMessage)
      onStatusRefresh()
    }
  }, [acceptMutation, agreed, onStatusRefresh, signaturePngDataUrl, t, version])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="w-full max-w-2xl mx-4 bg-card rounded-xl shadow-2xl max-h-[95vh] flex flex-col">
        <div className="flex items-start gap-3 px-6 py-4 border-b border-border shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {t('contractorAgreement.title', 'Independent Contractor Agreement')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('terms.version', 'Version')}: {version}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="text-sm text-foreground/80 leading-relaxed">
            {t(
              'contractorAgreement.intro',
              '{{name}}, your staff profile is marked as a Contractor Agent. Sign the current Independent Contractor agreement before entering the workspace.',
              { name: staffName }
            )}
          </p>

          <ContractorAgreementDocument
            contractorName={staffName}
            firmSigner={firmSigner}
            organization={organization}
          />

          <div className="flex items-start gap-3 border-t border-border py-4">
            <input
              type="checkbox"
              id="agree-contractor-agreement"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              disabled={isSubmitting}
              className="mt-1 h-4 w-4 cursor-pointer rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label
              htmlFor="agree-contractor-agreement"
              className="cursor-pointer text-sm leading-relaxed text-foreground"
            >
              {t(
                'contractorAgreement.acknowledgment',
                'I have reviewed the Independent Contractor agreement and agree to sign it electronically.'
              )}
            </label>
          </div>

          <div className="py-4">
            <h2 className="font-medium text-foreground mb-3">
              {t('terms.signature', 'Your Signature')}
            </h2>
            <SignaturePad onSignatureChange={setSignaturePngDataUrl} disabled={isSubmitting} />
          </div>
        </div>

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
                {t('contractorAgreement.signAndContinue', 'Sign and Continue')}
              </>
            )}
          </button>
          <p className="text-xs text-muted-foreground text-center mt-3">
            {t(
              'contractorAgreement.submitHint',
              'Your signature will be applied to the agreement PDF and stored with your staff profile.'
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
