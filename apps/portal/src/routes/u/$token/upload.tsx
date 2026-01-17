/**
 * Upload Page
 * Main document upload flow with enhanced uploader
 * Mobile-first UI with progress tracking
 */
import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@ella/ui'
import { portalApi, type PortalData } from '../../../lib/api-client'
import { getText, type Language } from '../../../lib/i18n'
import { EnhancedUploader } from '../../../components/upload/enhanced-uploader'

export const Route = createFileRoute('/u/$token/upload')({
  component: UploadPage,
})

type PageState = 'loading' | 'select' | 'success' | 'error'

function UploadPage() {
  const params = Route.useParams()
  const token = params.token as string
  const navigate = useNavigate()

  const [pageState, setPageState] = useState<PageState>('loading')
  const [data, setData] = useState<PortalData | null>(null)
  const [uploadedCount, setUploadedCount] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')

  const language: Language = data?.client.language || 'VI'
  const t = getText(language)

  // Load portal data to validate token
  useEffect(() => {
    async function loadData() {
      console.log('Upload page: Loading data for token', token)
      try {
        const result = await portalApi.getData(token)
        console.log('Upload page: Data loaded, setting pageState to select')
        setData(result)
        setPageState('select')
      } catch (err) {
        console.log('Upload page: Error loading data, redirecting', err)
        navigate({ to: '/u/$token', params: { token } })
      }
    }
    loadData()
  }, [token, navigate])

  console.log('Upload page render:', { pageState, hasData: !!data })

  // Handle navigation
  function handleBack() {
    navigate({ to: '/u/$token', params: { token } })
  }

  function handleUploadMore() {
    setPageState('select')
    setUploadedCount(0)
  }

  function handleDone() {
    navigate({ to: '/u/$token', params: { token } })
  }

  function handleRetry() {
    setPageState('select')
    setErrorMessage('')
  }

  // Loading state
  if (pageState === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="px-4 py-3 flex items-center gap-3 border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={handleBack}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground flex-1">
          {t.uploadTitle}
        </h1>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col p-6">
        {/* Selection state - EnhancedUploader handles file selection + upload */}
        {pageState === 'select' && (
          <EnhancedUploader
            token={token}
            language={language}
            onUploadComplete={(result) => {
              setUploadedCount(result.uploaded)
              setPageState('success')
            }}
            onError={(message) => {
              setErrorMessage(message)
              setPageState('error')
            }}
          />
        )}

        {/* Success state */}
        {pageState === 'success' && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-center mb-8">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground mb-2">
                {t.thankYou}
              </h2>
              <p className="text-muted-foreground">
                {uploadedCount} {t.filesUploaded}
              </p>
            </div>

            <div className="w-full space-y-3">
              <Button
                variant="outline"
                className="w-full h-12 rounded-xl"
                onClick={handleUploadMore}
              >
                {t.uploadMore}
              </Button>
              <Button
                className="w-full h-12 rounded-xl"
                onClick={handleDone}
              >
                {t.done}
              </Button>
            </div>
          </div>
        )}

        {/* Error state */}
        {pageState === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-center mb-8">
              <div className="w-20 h-20 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-10 h-10 text-error" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {t.errorUploading}
              </h2>
              <p className="text-muted-foreground">{errorMessage}</p>
            </div>

            <div className="w-full space-y-3">
              <Button
                className="w-full h-12 rounded-xl"
                onClick={handleRetry}
              >
                {t.tryAgain}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={handleBack}
              >
                {t.backToHome}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
