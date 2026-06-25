import { useAuth, useUser } from '@clerk/clerk-react'
import { useTranslation } from 'react-i18next'
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react'
import { isDisabledAccountError } from '../../lib/api-client'
import { DisabledAccountScreen } from '../auth/disabled-account-screen'
import { useTermsStatus } from './use-terms'
import { TermsModal } from './terms-modal'

interface TermsGateProps {
  children: React.ReactNode
}

export function TermsGate({ children }: TermsGateProps) {
  const { t } = useTranslation()
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()
  const shouldCheckStatus = isLoaded && !!isSignedIn
  const { data: status, isLoading, isError, error, refetch } = useTermsStatus(shouldCheckStatus)

  // Not signed in - skip gate (login page needs to render)
  if (isLoaded && !isSignedIn) {
    return <>{children}</>
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">
          {t('terms.checkingStatus', 'Checking terms status...')}
        </p>
      </div>
    )
  }

  // Loading status (includes active retries - show spinner while webhook processes)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">
          {t('terms.checkingStatus', 'Checking terms status...')}
        </p>
      </div>
    )
  }

  if (isDisabledAccountError(error)) {
    return <DisabledAccountScreen />
  }

  // Error state - fail closed (block app, don't let through)
  if (isError || !status) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <AlertTriangle className="w-8 h-8 text-destructive" />
        <p className="text-sm text-muted-foreground">
          {t('terms.statusError', 'Unable to verify terms status')}
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

  // Not accepted - show modal
  if (!status.hasAccepted) {
    const staffName = user?.fullName || user?.firstName || 'Staff Member'
    return <TermsModal staffName={staffName} onAccepted={() => refetch()} />
  }

  // Accepted - render children
  return <>{children}</>
}
