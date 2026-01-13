/**
 * Status View Page
 * Shows document status (received, blurry, missing) for tax case
 * Mobile-first design with collapsible sections
 */
import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@ella/ui'
import { portalApi, type PortalData, ApiError } from '../../../lib/api-client'
import { getText, type Language } from '../../../lib/i18n'
import { DocStatusSection } from '../../../components/status/doc-status-section'
import { MissingDocsList } from '../../../components/status/missing-docs-list'

export const Route = createFileRoute('/u/$token/status')({
  component: StatusPage,
})

type PageState = 'loading' | 'success' | 'error'

function StatusPage() {
  const { token } = Route.useParams()
  const navigate = useNavigate()

  const [pageState, setPageState] = useState<PageState>('loading')
  const [data, setData] = useState<PortalData | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const language: Language = data?.client.language || 'VI'
  const t = getText(language)

  // Load portal data
  async function loadData() {
    setPageState('loading')
    setErrorMessage('')

    try {
      const result = await portalApi.getData(token)
      setData(result)
      setPageState('success')
    } catch (err) {
      setPageState('error')
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage(t.errorLoading)
      }
    }
  }

  // Initial load
  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  function handleBack() {
    navigate({ to: '/u/$token', params: { token } })
  }

  function handleUploadClick() {
    navigate({ to: '/u/$token/upload', params: { token } })
  }

  // Loading state
  if (pageState === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  // Error state
  if (pageState === 'error' || !data) {
    return (
      <div className="flex-1 flex flex-col">
        <header className="px-4 py-3 flex items-center gap-3 border-b border-border">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={handleBack}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">{t.viewStatus}</h1>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">{errorMessage}</p>
            <Button onClick={loadData} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              {t.tryAgain}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const { checklist } = data

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="px-4 py-3 flex items-center gap-3 border-b border-border sticky top-0 bg-background z-10">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={handleBack}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-foreground">{t.viewStatus}</h1>
          <p className="text-xs text-muted-foreground">
            {t.taxYear} {data.taxCase.taxYear}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={loadData}
        >
          <RefreshCw className="w-5 h-5" />
        </Button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Summary stats */}
        <div className="px-4 py-4 border-b border-border bg-muted/30">
          <div className="flex justify-center gap-4">
            <StatPill
              label={t.received}
              count={checklist.received.length}
              variant="success"
            />
            <StatPill
              label={t.needResend}
              count={checklist.blurry.length}
              variant={checklist.blurry.length > 0 ? 'warning' : 'muted'}
            />
            <StatPill
              label={t.missing}
              count={checklist.missing.length}
              variant={checklist.missing.length > 0 ? 'error' : 'muted'}
            />
          </div>
        </div>

        {/* Document sections */}
        <div className="p-4 space-y-4">
          {/* Blurry / Need resend (priority - show first if any) */}
          {checklist.blurry.length > 0 && (
            <DocStatusSection
              title={t.needResend}
              docs={checklist.blurry}
              variant="warning"
              language={language}
              showReason
              onUploadClick={handleUploadClick}
            />
          )}

          {/* Missing docs */}
          {checklist.missing.length > 0 && (
            <MissingDocsList
              docs={checklist.missing}
              language={language}
              onUploadClick={handleUploadClick}
            />
          )}

          {/* Received docs */}
          {checklist.received.length > 0 && (
            <DocStatusSection
              title={t.received}
              docs={checklist.received}
              variant="success"
              language={language}
              defaultExpanded={checklist.blurry.length === 0 && checklist.missing.length === 0}
            />
          )}

          {/* Empty state */}
          {checklist.received.length === 0 &&
            checklist.blurry.length === 0 &&
            checklist.missing.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">{t.noDocsYet}</p>
            </div>
          )}
        </div>
      </main>

      {/* Fixed bottom action */}
      {(checklist.blurry.length > 0 || checklist.missing.length > 0) && (
        <div className="p-4 border-t border-border bg-background">
          <Button
            className="w-full h-14 rounded-2xl text-base"
            onClick={handleUploadClick}
          >
            {t.uploadDocs}
          </Button>
        </div>
      )}
    </div>
  )
}

// Stat pill component
function StatPill({
  label,
  count,
  variant,
}: {
  label: string
  count: number
  variant: 'success' | 'warning' | 'error' | 'muted'
}) {
  const colors = {
    success: 'bg-primary/10 text-primary',
    warning: 'bg-warning/10 text-warning',
    error: 'bg-error/10 text-error',
    muted: 'bg-muted text-muted-foreground',
  }

  return (
    <div className={`px-3 py-1.5 rounded-full text-center ${colors[variant]}`}>
      <span className="text-base font-semibold">{count}</span>
      <span className="ml-1.5 text-xs">{label}</span>
    </div>
  )
}
