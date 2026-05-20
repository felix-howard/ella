/**
 * Shared Portal Page Component
 * Used by both /upload/$token and /u/$token (legacy) routes
 */
import { useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@ella/ui'
import { type UploadResponse, ApiError } from '../lib/api-client'
import { portalDataQueryKey, usePortalDataQuery } from '../lib/portal-data-query'
import { WelcomeHeader } from './landing/welcome-header'
import { SimpleUploader } from './simple-uploader'
import { EntityPickerPage } from './entity-picker-page'
import { UploadedFilesList, type UploadedFilesListHandle } from './uploaded-files-list'

interface ErrorState {
  code: string
  message: string
}

export function PortalPage({ token }: { token: string }) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { data, error, isLoading, refetch } = usePortalDataQuery(token)
  const listRef = useRef<UploadedFilesListHandle>(null)

  useEffect(() => {
    if (!data || localStorage.getItem('ella-language')) return

    const clientLang = data.client.language === 'EN' ? 'en' : 'vi'
    if (i18n.language !== clientLang) {
      i18n.changeLanguage(clientLang)
    }
  }, [data, i18n])

  const handleReload = useCallback(() => {
    refetch()
  }, [refetch])

  // Upload complete handler - refresh data to update missing docs list
  const handleUploadComplete = useCallback(
    (_result: UploadResponse) => {
      listRef.current?.refetch()
      queryClient.invalidateQueries({ queryKey: portalDataQueryKey(token) })
    },
    [queryClient, token]
  )

  // Upload error handler
  const handleUploadError = useCallback((message: string) => {
    console.error('Upload error:', message)
  }, [])

  // Loading state
  if (isLoading) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        role="status"
        aria-label={t('common.processing')}
      >
        <div className="text-center">
          <Loader2
            className="w-10 h-10 text-primary animate-spin mx-auto mb-4"
            aria-hidden="true"
          />
          <p className="text-muted-foreground">{t('common.processing')}</p>
        </div>
      </div>
    )
  }

  // Error state
  if (!data) {
    return (
      <ErrorView
        error={toErrorState(error, t('portal.errorLoading'), t('portal.rateLimited'))}
        onRetry={handleReload}
      />
    )
  }

  // Multi-entity GROUP scope → tile picker (solo bypass falls through below)
  if (data.scope === 'GROUP' && data.entities.length > 1) {
    return (
      <EntityPickerPage
        token={token}
        clientName={data.client.name}
        taxYear={data.taxYear ?? data.entities[0]?.taxYear ?? 0}
        entities={data.entities}
      />
    )
  }

  // GROUP with single entity → bypass picker, but still send targetCaseId
  // so backend tags the upload as PORTAL_EXPLICIT (no AI entity routing).
  const soloTargetCaseId =
    data.scope === 'GROUP' && data.entities.length === 1 ? data.entities[0].caseId : undefined
  const uploadedFilesCaseId = soloTargetCaseId ?? data.taxCase?.id ?? data.entities[0]?.caseId

  // Header tax year: prefer taxCase (CASE), then top-level taxYear (GROUP), then first entity (defensive).
  const headerTaxYear = data.taxCase?.taxYear ?? data.taxYear ?? data.entities[0]?.taxYear

  // Success state — solo individual / legacy CASE scope (zero regression)
  return (
    <div className="flex-1 flex flex-col">
      <WelcomeHeader clientName={data.client.name} taxYear={headerTaxYear} />

      <div className="px-6 py-6">
        <SimpleUploader
          token={token}
          targetCaseId={soloTargetCaseId}
          onUploadComplete={handleUploadComplete}
          onError={handleUploadError}
        />
      </div>

      {uploadedFilesCaseId && (
        <div className="px-6 py-4">
          <UploadedFilesList ref={listRef} token={token} caseId={uploadedFilesCaseId} />
        </div>
      )}

      <div className="px-6 py-4">
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            {t('portal.disclaimerTitle')}
          </p>
          <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1">
            <li>{t('portal.disclaimer1')}</li>
            <li>{t('portal.disclaimer2')}</li>
          </ol>
        </div>
      </div>

      <footer className="px-6 py-4 text-center">
        <p className="text-xs text-muted-foreground">Ella Tax Document System</p>
      </footer>
    </div>
  )
}

function ErrorView({ error, onRetry }: { error: ErrorState | null; onRetry: () => void }) {
  const { t } = useTranslation()

  const isInvalidLink = error?.code === 'INVALID_TOKEN' || error?.code === 'EXPIRED_TOKEN'
  const isRateLimited = error?.code === 'RATE_LIMITED'
  const errorMessage =
    error?.code === 'INVALID_TOKEN'
      ? t('portal.invalidLinkMessage')
      : error?.code === 'EXPIRED_TOKEN'
        ? t('portal.expiredLinkMessage')
        : error?.message || t('portal.contactOffice')

  return (
    <div className="flex-1 flex items-center justify-center p-6" role="alert" aria-live="polite">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-error" aria-hidden="true" />
        </div>

        <h2 className="text-xl font-semibold text-foreground mb-2">
          {isInvalidLink ? t('portal.invalidLink') : t('portal.errorLoading')}
        </h2>

        <p className="text-muted-foreground mb-6">{errorMessage}</p>

        {!isInvalidLink && !isRateLimited && (
          <Button onClick={onRetry} className="gap-2" aria-label={t('common.tryAgain')}>
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            {t('common.tryAgain')}
          </Button>
        )}
      </div>
    </div>
  )
}

function toErrorState(
  error: unknown,
  fallbackMessage: string,
  rateLimitedMessage: string
): ErrorState | null {
  if (!error) return null
  if (error instanceof ApiError) {
    return {
      code: error.code,
      message: error.code === 'RATE_LIMITED' ? rateLimitedMessage : error.message,
    }
  }
  return { code: 'UNKNOWN', message: fallbackMessage }
}
