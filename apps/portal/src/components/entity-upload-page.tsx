/**
 * Entity Upload Page
 * Per-entity portal page reached after picking a tile on the landing screen:
 *   /u/$token/e/$caseId  (and its /upload/... mirror).
 * Composes: back link, entity header, <SimpleUploader /> targeted at caseId,
 *           <UploadedFilesList /> showing existing uploads with delete.
 */
import { useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@ella/ui'
import { type UploadResponse, ApiError } from '../lib/api-client'
import { portalDataQueryKey, usePortalDataQuery } from '../lib/portal-data-query'
import { entityTypeLabel } from '../lib/entity-type-label'
import { SimpleUploader } from './simple-uploader'
import { EntityUploadHeader } from './entity-upload-header'
import { UploadedFilesList, type UploadedFilesListHandle } from './uploaded-files-list'

interface EntityUploadPageProps {
  token: string
  caseId: string
}

export function EntityUploadPage({ token, caseId }: EntityUploadPageProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const useUploadPrefix = pathname.startsWith('/upload/')
  const queryClient = useQueryClient()
  const { data, error, isLoading } = usePortalDataQuery(token)
  const listRef = useRef<UploadedFilesListHandle>(null)
  const entity = data?.entities.find((e) => e.caseId === caseId) ?? null

  const handleBack = useCallback(() => {
    if (useUploadPrefix) {
      navigate({ to: '/upload/$token', params: { token } })
    } else {
      navigate({ to: '/u/$token', params: { token } })
    }
  }, [navigate, token, useUploadPrefix])

  const handleUploadComplete = useCallback(
    (_result: UploadResponse) => {
      listRef.current?.refetch()
      queryClient.invalidateQueries({ queryKey: portalDataQueryKey(token) })
    },
    [queryClient, token]
  )

  const handleUploadError = useCallback((message: string) => {
    console.error('Upload error:', message)
  }, [])

  if (isLoading && !data) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        role="status"
        aria-label={t('common.processing')}
      >
        <Loader2 className="w-8 h-8 text-primary animate-spin" aria-hidden="true" />
      </div>
    )
  }

  if (!entity) {
    const message =
      error instanceof ApiError && error.code === 'RATE_LIMITED'
        ? t('portal.rateLimited')
        : error instanceof ApiError
          ? error.message
          : t('portal.errorLoading')
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center" role="alert">
        <div className="max-w-sm">
          <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6 text-error" aria-hidden="true" />
          </div>
          <p className="text-foreground mb-4">{error ? message : t('portal.invalidLink')}</p>
          <Button onClick={handleBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            {t('portal.entityUpload.back')}
          </Button>
        </div>
      </div>
    )
  }

  const label = entityTypeLabel(entity, t)

  return (
    <div className="flex-1 flex flex-col">
      <main className="mx-auto w-full max-w-4xl flex-1 pt-8 sm:pt-12 lg:pt-14">
        <section className="rounded-[1.5rem] border border-white/80 bg-white/65 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.07)] backdrop-blur-sm sm:rounded-[2rem] sm:p-6 lg:p-8">
          <EntityUploadHeader entity={entity} label={label} onBack={handleBack} />

          <div className="mt-7 rounded-2xl border border-primary/10 bg-primary/5 p-4 sm:mt-8 sm:p-5">
            <p className="text-lg font-semibold leading-snug text-foreground sm:text-xl">
              {t('portal.entityUpload.helperTitle', { name: entity.name })}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t('portal.entityUpload.helperSwitch')}
            </p>
          </div>

          <div className="mt-6 sm:mt-7">
            <SimpleUploader
              token={token}
              targetCaseId={caseId}
              onUploadComplete={handleUploadComplete}
              onError={handleUploadError}
            />
          </div>

          <div className="mt-8">
            <UploadedFilesList ref={listRef} token={token} caseId={caseId} />
          </div>
        </section>
      </main>

      <footer className="px-6 py-6 mt-auto text-center">
        <p className="text-sm font-medium text-muted-foreground">Ella Tax Document System</p>
      </footer>
    </div>
  )
}
