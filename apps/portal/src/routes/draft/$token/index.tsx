/**
 * Draft Return Viewer - Public portal page for viewing draft tax returns
 * Token-based access, no authentication required
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Loader2, AlertCircle, FileText, Calendar, RefreshCw } from 'lucide-react'
import { Button } from '@ella/ui'
import { portalApi, ApiError, type DraftReturnData } from '../../../lib/api-client'
import { PdfViewer } from '../../../components/pdf-viewer'

export const Route = createFileRoute('/draft/$token/')({
  component: DraftViewerPage,
})

type PageState = 'loading' | 'success' | 'error'

interface ErrorState {
  code: string
  message: string
}

function DraftViewerPage() {
  const { token } = Route.useParams()
  const { t, i18n } = useTranslation()

  const [state, setState] = useState<PageState>('loading')
  const [data, setData] = useState<DraftReturnData | null>(null)
  const [error, setError] = useState<ErrorState | null>(null)
  const viewTrackedRef = useRef(false)

  // Fetch draft return data
  useEffect(() => {
    let mounted = true

    async function fetchData() {
      setState('loading')
      setError(null)

      try {
        const result = await portalApi.getDraft(token)
        if (mounted) {
          setData(result)
          setState('success')
          // Sync language from client data
          if (!localStorage.getItem('ella-language')) {
            const clientLang = result.clientLanguage === 'EN' ? 'en' : 'vi'
            if (i18n.language !== clientLang) {
              i18n.changeLanguage(clientLang)
            }
          }
        }
      } catch (err) {
        if (mounted) {
          setState('error')
          if (err instanceof ApiError) {
            setError({ code: err.code, message: err.message })
          } else {
            setError({ code: 'UNKNOWN', message: t('draft.errorLoading') })
          }
        }
      }
    }

    fetchData()
    return () => { mounted = false }
  }, [token, i18n, t])

  // Track view when PDF loads (once)
  useEffect(() => {
    if (state === 'success' && !viewTrackedRef.current) {
      viewTrackedRef.current = true
      portalApi.trackDraftView(token).catch(console.error)
    }
  }, [state, token])

  // Reload handler
  const handleReload = useCallback(() => {
    viewTrackedRef.current = false
    setState('loading')
    portalApi.getDraft(token)
      .then((result) => {
        setData(result)
        setState('success')
      })
      .catch((err) => {
        setState('error')
        if (err instanceof ApiError) {
          setError({ code: err.code, message: err.message })
        } else {
          setError({ code: 'UNKNOWN', message: t('draft.errorLoading') })
        }
      })
  }, [token, t])

  // Loading state
  if (state === 'loading') {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        role="status"
        aria-label={t('common.processing')}
      >
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">{t('draft.loading')}</p>
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
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border bg-card">
        <h1 className="text-lg font-semibold text-foreground text-center mb-2">
          {t('draft.title')}
        </h1>
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <FileText className="w-4 h-4" />
            {data.clientName}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            {t('draft.taxYear')}: {data.taxYear}
          </span>
          <span>
            {t('draft.version')}: {data.version}
          </span>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 min-h-0">
        <PdfViewer url={data.pdfUrl} filename={data.filename} />
      </div>

      {/* Footer */}
      <footer className="px-4 py-3 text-center border-t border-border bg-muted/30">
        <p className="text-xs text-muted-foreground">
          {t('draft.contactCpa')}
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

  const isInvalidLink = ['INVALID_TOKEN', 'LINK_REVOKED', 'LINK_EXPIRED'].includes(error?.code || '')

  const getErrorMessage = () => {
    switch (error?.code) {
      case 'INVALID_TOKEN':
        return t('draft.errorInvalidLink')
      case 'LINK_REVOKED':
        return t('draft.errorRevoked')
      case 'LINK_EXPIRED':
        return t('draft.errorExpired')
      default:
        return error?.message || t('draft.errorLoading')
    }
  }

  return (
    <div
      className="flex-1 flex items-center justify-center p-6"
      role="alert"
      aria-live="polite"
    >
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>

        <h2 className="text-xl font-semibold text-foreground mb-2">
          {isInvalidLink ? t('draft.linkInvalid') : t('draft.errorTitle')}
        </h2>

        <p className="text-muted-foreground mb-6">
          {getErrorMessage()}
        </p>

        {!isInvalidLink && (
          <Button onClick={onRetry} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            {t('common.tryAgain')}
          </Button>
        )}

        <p className="text-sm text-muted-foreground mt-6">
          {t('draft.contactCpa')}
        </p>
      </div>
    </div>
  )
}
