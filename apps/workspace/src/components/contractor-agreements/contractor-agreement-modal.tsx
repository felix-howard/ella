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

function createTypedSignatureDataUrl(name: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 720
  canvas.height = 220

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Signature canvas is not available')
  }

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#111827'
  context.font = 'italic 64px "Brush Script MT", "Segoe Script", cursive'
  context.textBaseline = 'middle'
  context.fillText(name, 48, 100, 624)
  context.strokeStyle = '#111827'
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(48, 158)
  context.lineTo(520, 158)
  context.stroke()

  return canvas.toDataURL('image/png')
}

export function ContractorAgreementModal({
  firmSigner,
  organization,
  staffName,
  version,
  onStatusRefresh,
}: ContractorAgreementModalProps) {
  const { t } = useTranslation()
  const [signaturePngDataUrl, setSignaturePngDataUrl] = useState<string | null>(null)
  const acceptMutation = useAcceptContractorAgreement()

  const isSubmitting = acceptMutation.isPending
  const canSubmit = !isSubmitting

  const handleSubmit = useCallback(async () => {
    try {
      const signatureDataUrl = signaturePngDataUrl ?? createTypedSignatureDataUrl(staffName)
      await acceptMutation.mutateAsync({ version, signaturePngDataUrl: signatureDataUrl })
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
  }, [acceptMutation, onStatusRefresh, signaturePngDataUrl, staffName, t, version])

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

          <div className="py-2">
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
