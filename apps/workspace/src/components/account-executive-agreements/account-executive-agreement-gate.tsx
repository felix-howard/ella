import { useAuth } from '@clerk/clerk-react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import { isDisabledAccountError } from '../../lib/api-client'
import { DisabledAccountScreen } from '../auth/disabled-account-screen'
import { useAccountExecutiveAgreementStatus } from './use-account-executive-agreements'
import { AccountExecutiveAgreementModal } from './account-executive-agreement-modal'

interface AccountExecutiveAgreementGateProps {
  children: React.ReactNode
}

export function AccountExecutiveAgreementGate({ children }: AccountExecutiveAgreementGateProps) {
  const { t } = useTranslation()
  const { isLoaded, isSignedIn } = useAuth()
  const shouldCheckStatus = isLoaded && !!isSignedIn
  const {
    data: status,
    isLoading,
    isError,
    error,
    refetch,
  } = useAccountExecutiveAgreementStatus(shouldCheckStatus)
  const checkingStatusLabel = t(
    'accountExecutiveAgreement.checkingStatus',
    'Checking account executive agreement status...',
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
          {t(
            'accountExecutiveAgreement.statusError',
            'Unable to verify account executive agreement status',
          )}
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

  return (
    <AccountExecutiveAgreementModal
      companyName={status.organizationName}
      signerName={status.signerName}
      version={status.currentVersion}
      onStatusRefresh={() => refetch()}
    />
  )
}
