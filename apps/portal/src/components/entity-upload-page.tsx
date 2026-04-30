/**
 * Entity Upload Page
 * Per-entity portal page reached after picking a tile on the landing screen:
 *   /u/$token/e/$caseId  (and its /upload/... mirror).
 * Composes: back link, entity header, <SimpleUploader /> targeted at caseId,
 *           <UploadedFilesList /> showing existing uploads with delete.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { Button } from '@ella/ui'
import {
  portalApi,
  type PortalEntity,
  type UploadResponse,
  ApiError,
} from '../lib/api-client'
import { entityTypeLabel } from '../lib/entity-type-label'
import { SimpleUploader } from './simple-uploader'
import { EntityUploadHeader } from './entity-upload-header'
import {
  UploadedFilesList,
  type UploadedFilesListHandle,
} from './uploaded-files-list'

interface EntityUploadPageProps {
  token: string
  caseId: string
}

export function EntityUploadPage({ token, caseId }: EntityUploadPageProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const useUploadPrefix = pathname.startsWith('/upload/')

  const [entity, setEntity] = useState<PortalEntity | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<UploadedFilesListHandle>(null)

  // Reset to loading when route params change (React 19 guidance:
  // adjust state during render via stored deps key, not inside useEffect).
  const depsKey = `${token}|${caseId}`
  const [prevDepsKey, setPrevDepsKey] = useState(depsKey)
  if (prevDepsKey !== depsKey) {
    setPrevDepsKey(depsKey)
    setEntity(null)
    setLoading(true)
    setError(null)
  }

  useEffect(() => {
    let cancelled = false
    portalApi
      .getData(token)
      .then((data) => {
        if (cancelled) return
        const found = data.entities.find((e) => e.caseId === caseId)
        if (!found) {
          setError(t('portal.invalidLink'))
        } else {
          setEntity(found)
        }
      })
      .catch((err) => {
        if (cancelled) return
        setError(
          err instanceof ApiError ? err.message : t('portal.errorLoading')
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, caseId, t])

  const handleBack = useCallback(() => {
    if (useUploadPrefix) {
      navigate({ to: '/upload/$token', params: { token } })
    } else {
      navigate({ to: '/u/$token', params: { token } })
    }
  }, [navigate, token, useUploadPrefix])

  const handleUploadComplete = useCallback((_result: UploadResponse) => {
    listRef.current?.refetch()
  }, [])

  const handleUploadError = useCallback((message: string) => {
    console.error('Upload error:', message)
  }, [])

  if (loading) {
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

  if (error || !entity) {
    return (
      <div
        className="flex-1 flex items-center justify-center p-6 text-center"
        role="alert"
      >
        <div className="max-w-sm">
          <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-6 h-6 text-error" aria-hidden="true" />
          </div>
          <p className="text-foreground mb-4">{error ?? t('portal.errorLoading')}</p>
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
      <EntityUploadHeader entity={entity} label={label} onBack={handleBack} />

      <div className="px-6 pt-2 pb-4 space-y-2">
        <p className="text-sm text-foreground">
          {t('portal.entityUpload.helperTitle', { name: entity.name })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t('portal.entityUpload.helperSwitch')}
        </p>
      </div>

      <div className="px-6 py-4">
        <SimpleUploader
          token={token}
          targetCaseId={caseId}
          onUploadComplete={handleUploadComplete}
          onError={handleUploadError}
        />
      </div>

      <div className="px-6 py-4">
        <UploadedFilesList ref={listRef} token={token} caseId={caseId} />
      </div>

      <footer className="px-6 py-4 mt-auto text-center">
        <p className="text-xs text-muted-foreground">Ella Tax Document System</p>
      </footer>
    </div>
  )
}
