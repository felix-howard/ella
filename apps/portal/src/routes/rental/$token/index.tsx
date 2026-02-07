/**
 * Rental Form Page
 * Client-facing Schedule E rental property collection via magic link
 */
import { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { Button, EllaLogoLight } from '@ella/ui'
import { useTranslation, Trans } from 'react-i18next'
import { ApiError } from '../../../lib/api-client'
import { rentalApi, type RentalFormData } from '../../../features/rental/lib/rental-api'

// Lazy load RentalForm
const RentalForm = lazy(() =>
  import('../../../features/rental/components/rental-form').then((m) => ({
    default: m.RentalForm,
  }))
)

export const Route = createFileRoute('/rental/$token/')({
  component: RentalFormPage,
})

type PageState = 'loading' | 'success' | 'error'

interface ErrorState {
  code: string
  message: string
}

function RentalFormPage() {
  const { token } = Route.useParams()
  const { t, i18n } = useTranslation()

  const [state, setState] = useState<PageState>('loading')
  const [data, setData] = useState<RentalFormData | null>(null)
  const [error, setError] = useState<ErrorState | null>(null)

  const isMountedRef = useRef(true)

  // Initial data load
  useEffect(() => {
    isMountedRef.current = true

    async function fetchData() {
      setState('loading')
      setError(null)

      try {
        const result = await rentalApi.getData(token)
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
            setError({
              code: 'UNKNOWN',
              message: t('rental.cannotLoadData'),
            })
          }
        }
      }
    }

    fetchData()
    return () => {
      isMountedRef.current = false
    }
  }, [token, t])

  // Reload handler
  const handleReload = useCallback(() => {
    if (!isMountedRef.current) return

    setState('loading')
    setError(null)
    rentalApi
      .getData(token)
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
            setError({
              code: 'UNKNOWN',
              message: t('rental.cannotLoadData'),
            })
          }
        }
      })
  }, [token, t])

  // Loading state
  if (state === 'loading') {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        role="status"
        aria-label={t('common.loading')}
      >
        <div className="text-center">
          <Loader2
            className="w-10 h-10 text-primary animate-spin mx-auto mb-4"
            aria-hidden="true"
          />
          <p className="text-muted-foreground">{t('rental.loadingForm')}</p>
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
      {/* Header */}
      <header className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <img src={EllaLogoLight} alt="Ella Tax" className="h-10" />
            <div>
              <h1 className="text-lg font-semibold text-foreground">{t('rental.formTitle')}</h1>
              <p className="text-sm text-muted-foreground">{t('portal.taxYear')} {data.taxYear}</p>
            </div>
          </div>

          {/* Language toggle button */}
          <button
            onClick={() => i18n.changeLanguage(i18n.language === 'vi' ? 'en' : 'vi')}
            className="px-3 py-1 text-xs font-medium rounded-full border border-border bg-muted hover:bg-muted/80 transition-colors"
          >
            {i18n.language === 'vi' ? 'EN' : 'VI'}
          </button>
        </div>

        {/* Client greeting */}
        <p className="text-sm text-muted-foreground">
          <Trans
            i18nKey="rental.greeting"
            values={{ clientName: data.client.name }}
            components={{ 1: <span className="font-medium text-accent" /> }}
          />
        </p>
      </header>

      {/* Form (lazy loaded) */}
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        }
      >
        <RentalForm token={token} initialData={data} />
      </Suspense>

      {/* Footer */}
      <footer className="px-6 py-4 text-center mt-auto">
        <p className="text-xs text-muted-foreground">{t('footer.questionsContact')}</p>
        <p className="text-xs text-muted-foreground mt-1">{t('footer.systemName')}</p>
      </footer>
    </div>
  )
}

// Error view component
function ErrorView({ error, onRetry }: { error: ErrorState | null; onRetry: () => void }) {
  const { t } = useTranslation()
  const isInvalidLink = useMemo(
    () =>
      error?.code === 'INVALID_TOKEN' ||
      error?.code === 'INVALID_TOKEN_TYPE' ||
      error?.code === 'EXPIRED_TOKEN' ||
      error?.code === 'LINK_DEACTIVATED',
    [error?.code]
  )

  return (
    <div className="flex-1 flex items-center justify-center p-6" role="alert" aria-live="polite">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-error" aria-hidden="true" />
        </div>

        <h2 className="text-xl font-semibold text-foreground mb-2">
          {isInvalidLink ? t('rental.invalidLinkTitle') : t('rental.cannotLoadData')}
        </h2>

        <p className="text-muted-foreground mb-6">
          {error?.message || t('rental.errorMessage')}
        </p>

        {!isInvalidLink && (
          <Button onClick={onRetry} className="gap-2" aria-label={t('common.tryAgain')}>
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            {t('common.tryAgain')}
          </Button>
        )}

        {isInvalidLink && (
          <p className="text-sm text-muted-foreground">
            {t('rental.contactCPA')}
          </p>
        )}
      </div>
    </div>
  )
}
