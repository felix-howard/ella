import { useAuth, useUser } from '@clerk/clerk-react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import { isDisabledAccountError } from '../../lib/api-client'
import { DisabledAccountScreen } from '../auth/disabled-account-screen'
import { useContractorAgreementStatus } from './use-contractor-agreements'
import { ContractorAgreementModal } from './contractor-agreement-modal'

interface ContractorAgreementGateProps {
  children: React.ReactNode
}

export function ContractorAgreementGate({ children }: ContractorAgreementGateProps) {
  const { t } = useTranslation()
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()
  const shouldCheckStatus = isLoaded && !!isSignedIn
  const {
    data: status,
    isLoading,
    isError,
    error,
    refetch,
  } = useContractorAgreementStatus(shouldCheckStatus)
  const checkingStatusLabel = t(
    'contractorAgreement.checkingStatus',
    'Checking contractor agreement status...',
  )

  if (isLoaded && !isSignedIn) {
    return <>{children}</>
  }

  if (!isLoaded || isLoading) {
    return (
      <div
        className="min-h-screen bg-background flex items-center justify-center"
        role="status"
        aria-label={checkingStatusLabel}
      >
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (isDisabledAccountError(error)) {
    return <DisabledAccountScreen />
  }

  if (isError || !status) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <AlertTriangle className="w-8 h-8 text-destructive" />
        <p className="text-sm text-muted-foreground">
          {t('contractorAgreement.statusError', 'Unable to verify contractor agreement status')}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-md hover:bg-accent transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          {t('common.retry', 'Retry')}
        </button>
      </div>
    )
  }

  if (!status.required || status.hasAccepted) {
    return <>{children}</>
  }

  const staffName = user?.fullName || user?.firstName || 'Staff Member'

  return (
    <ContractorAgreementModal
      firmSigner={status.firmSigner}
      organization={status.organization}
      staffName={staffName}
      version={status.currentVersion}
      onStatusRefresh={() => refetch()}
    />
  )
}
