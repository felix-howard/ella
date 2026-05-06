/**
 * Public agreement signing page.
 * Mounted at both `/agreements/:token` (canonical) and `/nda/:token` (alias
 * retained so existing customer SMS links keep working forever).
 *
 * State machine:
 *   loading  -> ready (success) | error(invalid|expired|signed|voided|server)
 *   ready    -> submitting
 *   submitting -> confirmed (200) | error (409 signed / 410 expired / 429 rate / 5xx)
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { EllaLogoLight, EllaLogoDark } from '@ella/ui'
import {
  portalApi,
  ApiError,
  type AgreementPublicView,
  type AgreementSignResult,
} from '../../lib/api-client'
import { AgreementTemplateView } from './agreement-template-view'
import { AgreementCustomHtmlView } from './agreement-custom-html-view'
import { AgreementSignForm, type AgreementSignSubmission } from './agreement-sign-form'
import { AgreementConfirmationPanel } from './agreement-confirmation-panel'
import { AgreementErrorPanel, type AgreementErrorCode } from './agreement-error-panel'
import { toast } from '../../lib/toast-store'

type PageState = 'loading' | 'ready' | 'submitting' | 'confirmed' | 'error'

function mapLoadError(err: unknown): AgreementErrorCode {
  if (!(err instanceof ApiError)) return 'server'
  if (err.status === 404) return 'invalid'
  if (err.status === 410) return 'expired'
  if (err.status === 409) return 'signed'
  if (err.status === 429) return 'rate_limited'
  return 'server'
}

function mapSignError(err: unknown): AgreementErrorCode {
  if (!(err instanceof ApiError)) return 'server'
  if (err.status === 409) return 'signed'
  if (err.status === 410) return 'expired'
  if (err.status === 429) return 'rate_limited'
  if (err.status === 404) return 'invalid'
  return 'server'
}

function deriveStatusError(view: AgreementPublicView): AgreementErrorCode | null {
  if (view.expired) return 'expired'
  if (view.status === 'SIGNED') return 'signed'
  if (view.status === 'VOIDED') return 'voided'
  if (view.status !== 'SENT') return 'invalid'
  return null
}

interface AgreementSignPageProps {
  token: string
}

export function AgreementSignPage({ token }: AgreementSignPageProps) {
  const { t } = useTranslation()

  const [state, setState] = useState<PageState>('loading')
  const [view, setView] = useState<AgreementPublicView | null>(null)
  const [errorCode, setErrorCode] = useState<AgreementErrorCode | null>(null)
  const [reachedBottom, setReachedBottom] = useState(false)
  const [signed, setSigned] = useState<AgreementSignResult | null>(null)

  const [reloadCounter, setReloadCounter] = useState(0)
  const handleRetry = useCallback(() => setReloadCounter((n) => n + 1), [])

  // useRef guard for double-submit — belt-and-suspenders alongside `submitting`
  // state, in case a user manages to double-tap before React re-renders.
  const submittingRef = useRef(false)

  useEffect(() => {
    let mounted = true
    async function fetchAgreement() {
      try {
        const data = await portalApi.getAgreement(token)
        if (!mounted) return
        const statusError = deriveStatusError(data)
        setView(data)
        if (statusError) {
          setErrorCode(statusError)
          setState('error')
        } else {
          setErrorCode(null)
          setState('ready')
        }
      } catch (err) {
        if (!mounted) return
        setErrorCode(mapLoadError(err))
        setState('error')
      }
    }
    fetchAgreement()
    return () => {
      mounted = false
    }
  }, [token, reloadCounter])

  const handleSubmit = useCallback(
    async (payload: AgreementSignSubmission) => {
      if (submittingRef.current) return
      submittingRef.current = true
      setState('submitting')
      try {
        const result = await portalApi.signAgreement(token, payload)
        setSigned(result)
        setState('confirmed')
      } catch (err) {
        const code = mapSignError(err)
        setErrorCode(code)
        // Transient errors (server/rate limit) return the user to the ready
        // state so their signature + typed name aren't lost. Surface via toast.
        if (code === 'server' || code === 'rate_limited') {
          toast.error(t(`nda.error.${code}.message`))
          setState('ready')
        } else {
          setState('error')
        }
      } finally {
        submittingRef.current = false
      }
    },
    [token, t],
  )

  const handleReachBottom = useCallback(() => setReachedBottom(true), [])

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <header className="px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center justify-center">
          <img
            src={EllaLogoLight}
            alt="Ella"
            width={76}
            height={24}
            className="h-6 w-auto dark:hidden"
          />
          <img
            src={EllaLogoDark}
            alt="Ella"
            width={76}
            height={24}
            className="h-6 w-auto hidden dark:block"
          />
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl w-full mx-auto p-4 gap-4">
        {state === 'loading' && (
          <div
            className="flex-1 flex items-center justify-center"
            role="status"
            aria-label={t('common.processing')}
          >
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
        )}

        {state === 'error' && (
          <AgreementErrorPanel
            code={errorCode ?? 'server'}
            onRetry={
              errorCode === 'server' || errorCode === 'rate_limited' ? handleRetry : undefined
            }
          />
        )}

        {(state === 'ready' || state === 'submitting') && view && (
          <>
            <div className="shrink-0">
              <h1 className="text-lg font-semibold text-foreground">
                {view.templateTitle}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('nda.greeting', { firstName: view.leadFirstName })}
                {view.depositAmount &&
                  ` ${t('nda.depositNote', { amount: view.depositAmount })}`}
              </p>
            </div>
            {view.templateHtml ? (
              <AgreementCustomHtmlView
                title={view.templateTitle}
                html={view.templateHtml}
                onReachBottom={handleReachBottom}
                firmSnapshot={view.firmSnapshot}
                clientSnapshot={view.clientSnapshot}
              />
            ) : (
              <AgreementTemplateView
                title={view.templateTitle}
                sections={view.templateSections}
                onReachBottom={handleReachBottom}
                firmSnapshot={view.firmSnapshot}
                clientSnapshot={view.clientSnapshot}
              />
            )}
            <div className="shrink-0">
              <AgreementSignForm
                canSubmit={reachedBottom}
                submitting={state === 'submitting'}
                onSubmit={handleSubmit}
                firmSnapshot={view.firmSnapshot}
                clientType={view.clientSnapshot?.clientType ?? null}
              />
            </div>
          </>
        )}

        {state === 'confirmed' && signed && view && (
          <AgreementConfirmationPanel
            signedAt={signed.signedAt}
            downloadUrl={signed.downloadUrl}
            orgName={view.orgName}
          />
        )}
      </main>
    </div>
  )
}
