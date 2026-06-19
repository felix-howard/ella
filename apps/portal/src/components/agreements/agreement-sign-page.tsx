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
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Loader2, Lock, ShieldCheck } from 'lucide-react'
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

// Lazy-load the full PDF.js viewer (vertical scroll, fit-to-width, zoom) only
// when an uploaded PDF needs rendering — keeps the worker bundle out of the
// initial load for template-based agreements.
const PdfViewer = lazy(() => import('../pdf-viewer/index'))

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
    [token, t]
  )

  const handleReachBottom = useCallback(() => setReachedBottom(true), [])

  return (
    <div className="relative left-1/2 min-h-dvh w-screen -translate-x-1/2 flex flex-col bg-background">
      <header className="sticky top-0 z-20 shrink-0 border-b border-border/80 bg-background/85 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <img
              src={EllaLogoLight}
              alt="Ella"
              width={76}
              height={24}
              className="h-6 w-auto dark:hidden sm:h-7"
            />
            <img
              src={EllaLogoDark}
              alt="Ella"
              width={76}
              height={24}
              className="h-6 w-auto hidden dark:block sm:h-7"
            />
          </div>
          <div className="hidden sm:inline-flex items-center gap-2 rounded-full bg-card border border-border px-3 py-1.5 text-xs sm:text-sm font-semibold text-muted-foreground shadow-sm">
            <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
            <span>{t('nda.secureSigning')}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 lg:py-8">
        {state === 'loading' && (
          <div
            className="min-h-[60dvh] flex items-center justify-center"
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
          <div className="mx-auto grid w-full max-w-[calc(100vw-2rem)] gap-5 lg:max-w-none lg:grid-cols-[minmax(0,1fr)_380px]">
            <section className="lg:col-span-2 overflow-hidden rounded-xl border border-border bg-card shadow-card">
              <div className="border-b border-border bg-muted/30 px-5 py-4 sm:px-6 sm:py-5 lg:px-7">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-light text-primary-dark px-3 py-1.5 text-xs font-semibold">
                    <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                    {t('nda.documentBadge')}
                  </span>
                  {view.depositAmount && (
                    <span className="inline-flex items-center rounded-full bg-accent-light text-accent px-3 py-1.5 text-xs font-semibold">
                      {t('nda.depositBadge', { amount: view.depositAmount })}
                    </span>
                  )}
                </div>
              </div>
              <div className="px-5 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-7">
                <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">
                  {view.templateTitle}
                </h1>
                <p className="mt-2 max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
                  {t('nda.greeting', { firstName: view.leadFirstName })}
                </p>
              </div>
            </section>

            <div className="min-w-0 lg:h-full">
              {view.uploadedPdfUrl ? (
                <div className="h-[80vh] w-full overflow-hidden rounded-xl border border-border bg-muted/20 lg:h-[calc(100dvh-12rem)] lg:min-h-[80vh]">
                  <Suspense
                    fallback={
                      <div className="flex h-full items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    }
                  >
                    <PdfViewer url={view.uploadedPdfUrl} />
                  </Suspense>
                </div>
              ) : view.templateHtml ? (
                <AgreementCustomHtmlView
                  title={view.templateTitle}
                  html={view.templateHtml}
                  onReachBottom={handleReachBottom}
                  hideTitle
                />
              ) : (
                <AgreementTemplateView
                  title={view.templateTitle}
                  sections={view.templateSections}
                  onReachBottom={handleReachBottom}
                  hideTitle
                />
              )}
            </div>
            <div className="shrink-0 lg:sticky lg:top-24">
              <AgreementSignForm
                key={token}
                canSubmit={view.uploadedPdfUrl ? true : reachedBottom}
                submitting={state === 'submitting'}
                onSubmit={handleSubmit}
                firmSnapshot={view.firmSnapshot}
                clientType={view.clientSnapshot?.clientType ?? null}
                agreementType={view.type}
                consentPrefill={view.consentPrefill}
              />
            </div>
          </div>
        )}

        {state === 'confirmed' && signed && view && (
          <AgreementConfirmationPanel
            signedAt={signed.signedAt}
            downloadUrl={signed.downloadUrl}
            orgName={view.orgName}
          />
        )}
      </main>

      <footer className="border-t border-border bg-card/90 shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('nda.footerSecure')}</span>
          </div>
          <span className="font-medium">{t('nda.poweredBy')}</span>
        </div>
      </footer>
    </div>
  )
}
