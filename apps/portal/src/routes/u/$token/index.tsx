/**
 * Portal Landing Page - Single Page Experience
 * Consolidated view: welcome + missing docs + upload
 * Phase 2: UI components (MissingDocsList + SimpleUploader)
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@ella/ui'
import { portalApi, type PortalData, type UploadResponse, ApiError } from '../../../lib/api-client'
import { WelcomeHeader } from '../../../components/landing/welcome-header'
import { MissingDocsList } from '../../../components/missing-docs-list'
import { SimpleUploader } from '../../../components/simple-uploader'

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
  const { t, i18n } = useTranslation()

  const [state, setState] = useState<PageState>('loading')
  const [data, setData] = useState<PortalData | null>(null)
  const [error, setError] = useState<ErrorState | null>(null)

  // Ref to track if component is mounted (prevents stale updates)
  const isMountedRef = useRef(true)

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
          // Sync language from client data to i18n
          const clientLang = result.client.language === 'EN' ? 'en' : 'vi'
          if (i18n.language !== clientLang) {
            i18n.changeLanguage(clientLang)
          }
        }
      } catch (err) {
        if (isMountedRef.current) {
          setState('error')
          if (err instanceof ApiError) {
            setError({ code: err.code, message: err.message })
          } else {
            setError({ code: 'UNKNOWN', message: t('portal.errorLoading') })
          }
        }
      }
    }

    fetchData()
    return () => { isMountedRef.current = false }
  }, [token, i18n, t])

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
          // Sync language from client data to i18n
          const clientLang = result.client.language === 'EN' ? 'en' : 'vi'
          if (i18n.language !== clientLang) {
            i18n.changeLanguage(clientLang)
          }
        }
      })
      .catch((err) => {
        if (isMountedRef.current) {
          setState('error')
          if (err instanceof ApiError) {
            setError({ code: err.code, message: err.message })
          } else {
            setError({ code: 'UNKNOWN', message: t('portal.errorLoading') })
          }
        }
      })
  }, [token, i18n, t])

  // Upload complete handler - refresh data to update missing docs list
  const handleUploadComplete = useCallback(
    (_result: UploadResponse) => {
      // Refresh data to get updated checklist
      portalApi
        .getData(token)
        .then((newData) => {
          if (isMountedRef.current) {
            setData(newData)
          }
        })
        .catch((err) => {
          // Log error but don't crash - upload succeeded, refresh failed
          console.error('Failed to refresh data after upload:', err)
        })
    },
    [token]
  )

  // Upload error handler - SimpleUploader handles UI display
  const handleUploadError = useCallback((message: string) => {
    // Log for debugging - SimpleUploader shows the error toast
    console.error('Upload error:', message)
  }, [])

  // Loading state
  if (state === 'loading') {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        role="status"
        aria-label={t('common.processing')}
      >
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" aria-hidden="true" />
          <p className="text-muted-foreground">{t('common.processing')}</p>
        </div>
      </div>
    )
  }

  // Error state
  if (state === 'error' || !data) {
    return <ErrorView error={error} onRetry={handleReload} />
  }

  // Success state - Phase 3 simplified layout
  return (
    <div className="flex-1 flex flex-col">
      <WelcomeHeader clientName={data.client.name} taxYear={data.taxCase.taxYear} />

      {/* Upload button - primary action at top */}
      <div className="px-6 py-6">
        <SimpleUploader
          token={token}
          onUploadComplete={handleUploadComplete}
          onError={handleUploadError}
        />
      </div>

      {/* TODO: Re-enable checklist when engagement flow creates checklist upfront */}
      {/* <div className="flex-1 px-6 py-4">
        <MissingDocsList docs={data.checklist.missing} language={language} />
      </div> */}

      {/* Footer */}
      <footer className="px-6 py-4 text-center">
        <p className="text-xs text-muted-foreground">
          Ella Tax Document System
        </p>
      </footer>
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
  const { t } = useTranslation()

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
          {isInvalidLink ? t('portal.invalidLink') : t('portal.errorLoading')}
        </h2>

        <p className="text-muted-foreground mb-6">
          {error?.message || t('portal.contactOffice')}
        </p>

        {!isInvalidLink && (
          <Button onClick={onRetry} className="gap-2" aria-label={t('common.tryAgain')}>
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            {t('common.tryAgain')}
          </Button>
        )}
      </div>
    </div>
  )
}
