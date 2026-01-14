/**
 * Magic Link Landing Page
 * Entry point for clients accessing via magic link
 * Fetches portal data and shows upload/status options
 */
import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@ella/ui'
import { portalApi, type PortalData, ApiError } from '../../../lib/api-client'
import { getText, type Language } from '../../../lib/i18n'
import { WelcomeHeader } from '../../../components/landing/welcome-header'
import { UploadButtons } from '../../../components/landing/upload-buttons'

export const Route = createFileRoute('/u/$token/')({
  component: MagicLinkLanding,
})

type LoadingState = 'loading' | 'success' | 'error'

interface ErrorState {
  code: string
  message: string
}

function MagicLinkLanding() {
  const { token } = Route.useParams()
  const navigate = useNavigate()

  const [state, setState] = useState<LoadingState>('loading')
  const [data, setData] = useState<PortalData | null>(null)
  const [error, setError] = useState<ErrorState | null>(null)

  const language: Language = data?.client.language || 'VI'
  const t = getText(language)

  useEffect(() => {
    async function loadData() {
      setState('loading')
      setError(null)

      try {
        const result = await portalApi.getData(token)
        setData(result)
        setState('success')
      } catch (err) {
        setState('error')
        if (err instanceof ApiError) {
          setError({ code: err.code, message: err.message })
        } else {
          setError({ code: 'UNKNOWN', message: 'Không thể tải dữ liệu' })
        }
      }
    }
    loadData()
  }, [token])

  function handleReload() {
    setState('loading')
    portalApi.getData(token)
      .then((result) => {
        setData(result)
        setState('success')
      })
      .catch((err) => {
        setState('error')
        if (err instanceof ApiError) {
          setError({ code: err.code, message: err.message })
        } else {
          setError({ code: 'UNKNOWN', message: t.errorLoading })
        }
      })
  }

  function handleUploadClick() {
    console.log('Upload button clicked!', { token })
    navigate({ to: '/u/$token/upload', params: { token } })
  }

  function handleStatusClick() {
    navigate({ to: '/u/$token/status', params: { token } })
  }

  // Loading state
  if (state === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t.processing}</p>
        </div>
      </div>
    )
  }

  // Error state
  if (state === 'error' || !data) {
    return <ErrorView error={error} onRetry={handleReload} />
  }

  // Success state
  return (
    <div className="flex-1 flex flex-col">
      <WelcomeHeader
        clientName={data.client.name}
        taxYear={data.taxCase.taxYear}
        language={language}
      />

      {/* Stats summary */}
      <div className="px-6 py-4">
        <div className="flex justify-center gap-6">
          <StatBadge
            label={t.received}
            value={data.stats.verified}
            variant="success"
          />
          <StatBadge
            label={t.missing}
            value={data.stats.missing}
            variant={data.stats.missing > 0 ? 'warning' : 'muted'}
          />
        </div>
      </div>

      <UploadButtons
        language={language}
        onUploadClick={handleUploadClick}
        onStatusClick={handleStatusClick}
      />

      {/* Footer */}
      <footer className="px-6 py-4 text-center border-t border-border">
        <p className="text-xs text-muted-foreground">
          Ella Tax Document System
        </p>
      </footer>
    </div>
  )
}

// Stats badge component
function StatBadge({
  label,
  value,
  variant,
}: {
  label: string
  value: number
  variant: 'success' | 'warning' | 'muted'
}) {
  const colors = {
    success: 'bg-primary/10 text-primary',
    warning: 'bg-warning/10 text-warning',
    muted: 'bg-muted text-muted-foreground',
  }

  return (
    <div className={`px-4 py-2 rounded-full ${colors[variant]}`}>
      <span className="text-lg font-semibold">{value}</span>
      <span className="ml-2 text-sm">{label}</span>
    </div>
  )
}

// Error view component
function ErrorView({
  error,
  onRetry,
}: {
  error: ErrorState | null
  onRetry: () => void
}) {
  const t = getText('VI')

  const isInvalidLink = error?.code === 'INVALID_TOKEN' || error?.code === 'EXPIRED_TOKEN'

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-error" />
        </div>

        <h2 className="text-xl font-semibold text-foreground mb-2">
          {isInvalidLink ? t.invalidLink : t.errorLoading}
        </h2>

        <p className="text-muted-foreground mb-6">
          {error?.message || t.contactOffice}
        </p>

        {!isInvalidLink && (
          <Button onClick={onRetry} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            {t.tryAgain}
          </Button>
        )}
      </div>
    </div>
  )
}
