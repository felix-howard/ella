/**
 * Portal Landing Page - Single Page Experience
 * Consolidated view: welcome + missing docs + upload
 * Phase 1: Route consolidation (upload/status routes removed)
 */
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@ella/ui'
import { portalApi, type PortalData, ApiError } from '../../../lib/api-client'
import { getText, type Language } from '../../../lib/i18n'
import { WelcomeHeader } from '../../../components/landing/welcome-header'

export const Route = createFileRoute('/u/$token/')({
  component: PortalPage,
})

type PageState = 'loading' | 'success' | 'error'

interface ErrorState {
  code: string
  message: string
}

function PortalPage() {
  const { token } = Route.useParams()

  const [state, setState] = useState<PageState>('loading')
  const [data, setData] = useState<PortalData | null>(null)
  const [error, setError] = useState<ErrorState | null>(null)

  // Ref to track if component is mounted (prevents stale updates)
  const isMountedRef = useRef(true)

  const language: Language = data?.client.language || 'VI'
  const t = getText(language)

  // Initial data load
  useEffect(() => {
    isMountedRef.current = true

    async function fetchData() {
      setState('loading')
      setError(null)

      try {
        const result = await portalApi.getData(token)
        if (isMountedRef.current) {
          setData(result)
          setState('success')
        }
      } catch (err) {
        if (isMountedRef.current) {
          setState('error')
          if (err instanceof ApiError) {
            setError({ code: err.code, message: err.message })
          } else {
            setError({ code: 'UNKNOWN', message: getText('VI').errorLoading })
          }
        }
      }
    }

    fetchData()
    return () => { isMountedRef.current = false }
  }, [token])

  // Reload handler for retry button (uses same ref for cancellation)
  const handleReload = useCallback(() => {
    if (!isMountedRef.current) return

    setState('loading')
    setError(null)
    portalApi.getData(token)
      .then((result) => {
        if (isMountedRef.current) {
          setData(result)
          setState('success')
        }
      })
      .catch((err) => {
        if (isMountedRef.current) {
          setState('error')
          if (err instanceof ApiError) {
            setError({ code: err.code, message: err.message })
          } else {
            setError({ code: 'UNKNOWN', message: getText('VI').errorLoading })
          }
        }
      })
  }, [token])

  // Loading state
  if (state === 'loading') {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        role="status"
        aria-label={t.processing}
      >
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" aria-hidden="true" />
          <p className="text-muted-foreground">{t.processing}</p>
        </div>
      </div>
    )
  }

  // Error state
  if (state === 'error' || !data) {
    return <ErrorView error={error} onRetry={handleReload} language={language} />
  }

  // Success state - TODO: Phase 2 will add MissingDocsList and SimpleUploader here
  return (
    <div className="flex-1 flex flex-col">
      <WelcomeHeader
        clientName={data.client.name}
        taxYear={data.taxCase.taxYear}
        language={language}
      />

      {/* Stats summary - temporary until Phase 2 components */}
      <div className="px-6 py-4" role="region" aria-label={language === 'VI' ? 'Thống kê' : 'Statistics'}>
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

      {/* Placeholder for Phase 2: MissingDocsList component */}
      {data.checklist.missing.length > 0 && (
        <div className="flex-1 px-6 py-4" role="region" aria-label={language === 'VI' ? 'Tài liệu cần gửi' : 'Documents Needed'}>
          <h2 className="text-lg font-semibold mb-3">{language === 'VI' ? 'Tài liệu cần gửi' : 'Documents Needed'}</h2>
          <ul className="space-y-2" role="list">
            {data.checklist.missing.map((doc) => (
              <li key={doc.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                <span className="text-sm">{doc.labelVi}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Placeholder for Phase 2: SimpleUploader component */}
      <div className="px-6 py-6 border-t border-border">
        <p className="text-sm text-muted-foreground text-center mb-4">
          {language === 'VI' ? 'Upload component sẽ được thêm ở Phase 2' : 'Upload component will be added in Phase 2'}
        </p>
      </div>

      {/* Footer */}
      <footer className="px-6 py-4 text-center">
        <p className="text-xs text-muted-foreground">
          Ella Tax Document System
        </p>
      </footer>
    </div>
  )
}

// Color mappings for stat badges (memoized outside component to avoid recreation)
const STAT_BADGE_COLORS = {
  success: 'bg-primary/10 text-primary',
  warning: 'bg-warning/10 text-warning',
  muted: 'bg-muted text-muted-foreground',
} as const

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
  return (
    <div className={`px-4 py-2 rounded-full ${STAT_BADGE_COLORS[variant]}`} role="status">
      <span className="text-lg font-semibold">{value}</span>
      <span className="ml-2 text-sm">{label}</span>
    </div>
  )
}

// Error view component
function ErrorView({
  error,
  onRetry,
  language,
}: {
  error: ErrorState | null
  onRetry: () => void
  language: Language
}) {
  const t = useMemo(() => getText(language), [language])

  const isInvalidLink = error?.code === 'INVALID_TOKEN' || error?.code === 'EXPIRED_TOKEN'

  return (
    <div
      className="flex-1 flex items-center justify-center p-6"
      role="alert"
      aria-live="polite"
    >
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-error" aria-hidden="true" />
        </div>

        <h2 className="text-xl font-semibold text-foreground mb-2">
          {isInvalidLink ? t.invalidLink : t.errorLoading}
        </h2>

        <p className="text-muted-foreground mb-6">
          {error?.message || t.contactOffice}
        </p>

        {!isInvalidLink && (
          <Button onClick={onRetry} className="gap-2" aria-label={t.tryAgain}>
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            {t.tryAgain}
          </Button>
        )}
      </div>
    </div>
  )
}
