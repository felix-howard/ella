/**
 * Upload Page
 * Main document upload flow with image picker
 * Shows preview, handles upload, and displays success/error states
 */
import { useState, useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@ella/ui'
import { portalApi, type PortalData, ApiError } from '../../../lib/api-client'
import { getText, type Language } from '../../../lib/i18n'
import { ImagePicker } from '../../../components/upload/image-picker'

export const Route = createFileRoute('/u/$token/upload')({
  component: UploadPage,
})

type PageState = 'loading' | 'select' | 'uploading' | 'success' | 'error'

function UploadPage() {
  const params = Route.useParams()
  const token = params.token as string
  const navigate = useNavigate()

  const [pageState, setPageState] = useState<PageState>('loading')
  const [data, setData] = useState<PortalData | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [uploadedCount, setUploadedCount] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')

  const language: Language = data?.client.language || 'VI'
  const t = getText(language)

  // Load portal data to validate token
  useEffect(() => {
    async function loadData() {
      try {
        const result = await portalApi.getData(token)
        setData(result)
        setPageState('select')
      } catch {
        navigate({ to: '/u/$token', params: { token } })
      }
    }
    loadData()
  }, [token, navigate])

  // Handle file upload
  async function handleUpload() {
    if (files.length === 0) return

    setPageState('uploading')
    setErrorMessage('')

    try {
      const result = await portalApi.upload(token, files)
      setUploadedCount(result.uploaded)
      setPageState('success')
      setFiles([])
    } catch (err) {
      setPageState('error')
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage(t.errorUploading)
      }
    }
  }

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
        {/* Selection state */}
        {pageState === 'select' && (
          <>
            <div className="mb-4">
              <p className="text-sm text-muted-foreground text-center">
                {t.selectPhotos}
              </p>
            </div>

            <ImagePicker
              files={files}
              onFilesChange={setFiles}
              language={language}
              disabled={false}
            />

            {/* Upload button */}
            {files.length > 0 && (
              <div className="mt-auto pt-6 space-y-3">
                <Button
                  className="w-full h-14 text-base gap-2 rounded-2xl"
                  onClick={handleUpload}
                >
                  <Upload className="w-5 h-5" />
                  {t.upload} ({files.length})
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => setFiles([])}
                >
                  {t.cancel}
                </Button>
              </div>
            )}
          </>
        )}

        {/* Uploading state */}
        {pageState === 'uploading' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
              <p className="text-lg font-medium text-foreground">{t.uploading}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {files.length} {t.selectedFiles}
              </p>
            </div>
          </div>
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
