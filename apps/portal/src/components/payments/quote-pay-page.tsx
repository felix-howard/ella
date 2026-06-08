/**
 * Public sent-quote pay page, mounted at portal `/quote/:payToken`.
 *
 * Mirrors the deposit pay page state machine, but renders an itemized quote
 * breakdown and pays via the `/public/quote` endpoints (one-time or recurring
 * subscription, decided server-side from the frozen snapshot).
 *
 *   loading     -> ready | paid | error(invalid|canceled|server|rate_limited)
 *   ready       -> redirecting (POST checkout -> Stripe Checkout URL)
 *   confirming  -> paid (webhook landed) | ready | stays confirming w/ refresh
 *
 * Returning from Stripe with ?status=success enters `confirming`, polling until
 * the webhook settles the quote. ?status=canceled re-enters `ready`.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CreditCard, Info, Loader2, Lock } from 'lucide-react'
import { Button } from '@ella/ui'
import { ApiError } from '../../lib/api-client'
import {
  quoteApi,
  formatQuoteAmount,
  isQuotePaid,
  isQuoteCanceled,
  type PublicQuoteView,
} from '../../lib/quote-api'
import { toast } from '../../lib/toast-store'
import { PaymentPageShell } from './payment-page-shell'
import { QuoteBreakdown } from './quote-breakdown'
import { QuoteIntroPanel } from './quote-intro-panel'
import {
  PaymentPaidPanel,
  PaymentConfirmingPanel,
  PaymentErrorPanel,
  type PaymentErrorCode,
} from './payment-result-panels'

type PageState = 'loading' | 'ready' | 'redirecting' | 'confirming' | 'paid' | 'error'

// Webhook lag after Stripe redirect is usually seconds; poll briefly, then fall
// back to a manual "Check again" button rather than polling forever.
const POLL_INTERVAL_MS = 3000
const MAX_POLL_ATTEMPTS = 5

function mapLoadError(err: unknown): PaymentErrorCode {
  if (!(err instanceof ApiError)) return 'server'
  if (err.status === 404) return 'invalid'
  if (err.status === 429) return 'rate_limited'
  return 'server'
}

interface QuotePayPageProps {
  payToken: string
  /** Stripe return query param: 'success' | 'canceled' | undefined. */
  returnStatus?: 'success' | 'canceled'
}

export function QuotePayPage({ payToken, returnStatus }: QuotePayPageProps) {
  const { t, i18n } = useTranslation()

  const [state, setState] = useState<PageState>('loading')
  const [view, setView] = useState<PublicQuoteView | null>(null)
  const [errorCode, setErrorCode] = useState<PaymentErrorCode>('server')
  const [pollExhausted, setPollExhausted] = useState(false)
  // Bumping either counter re-runs the matching effect (full reload / new poll round).
  const [reloadCounter, setReloadCounter] = useState(0)
  const [pollRound, setPollRound] = useState(0)
  const redirectingRef = useRef(false)

  const handleRetry = useCallback(() => {
    setState('loading')
    setReloadCounter((n) => n + 1)
  }, [])

  /** Route a fetched view to the page state it implies. Shared by load + poll. */
  const applyViewState = useCallback(
    (data: PublicQuoteView, opts: { confirming: boolean }) => {
      setView(data)
      if (isQuotePaid(data.status)) {
        setState('paid')
      } else if (isQuoteCanceled(data.status)) {
        setErrorCode('canceled')
        setState('error')
      } else if (opts.confirming) {
        // Back from Stripe but the webhook hasn't settled the quote yet
        setState('confirming')
      } else {
        setState('ready')
      }
    },
    [],
  )

  // Initial load (+ reloads after 409s / retry button)
  useEffect(() => {
    let mounted = true
    quoteApi
      .getQuote(payToken)
      .then((data) => {
        if (mounted) applyViewState(data, { confirming: returnStatus === 'success' })
      })
      .catch((err) => {
        if (!mounted) return
        setErrorCode(mapLoadError(err))
        setState('error')
      })
    return () => {
      mounted = false
    }
  }, [payToken, returnStatus, reloadCounter, applyViewState])

  // Confirming: poll until a terminal status or attempts run out.
  useEffect(() => {
    if (state !== 'confirming') return
    let cancelled = false
    let attempts = 0
    const timer = setInterval(async () => {
      attempts += 1
      try {
        const data = await quoteApi.getQuote(payToken)
        if (cancelled) return
        applyViewState(data, { confirming: true })
      } catch {
        // Transient — keep polling until attempts are exhausted
      }
      if (!cancelled && attempts >= MAX_POLL_ATTEMPTS) {
        clearInterval(timer)
        setPollExhausted(true)
      }
    }, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [state, payToken, pollRound, applyViewState])

  const handleManualRefresh = useCallback(() => {
    setPollExhausted(false)
    setPollRound((n) => n + 1)
  }, [])

  const handlePay = useCallback(async () => {
    if (redirectingRef.current) return
    redirectingRef.current = true
    setState('redirecting')
    try {
      const { checkoutUrl } = await quoteApi.createCheckout(payToken)
      window.location.assign(checkoutUrl)
      // Stay in `redirecting` — browser is navigating away
    } catch (err) {
      redirectingRef.current = false
      if (err instanceof ApiError && err.status === 409) {
        // ALREADY_PAID / NOT_PAYABLE — refetch so the page renders the true state
        handleRetry()
        return
      }
      const code: PaymentErrorCode =
        err instanceof ApiError && err.status === 429 ? 'rate_limited' : 'server'
      toast.error(t(`pay.error.${code}.message`))
      setState('ready')
    }
  }, [payToken, t, handleRetry])

  const dueTodayFormatted = view ? formatQuoteAmount(view.dueToday, i18n.language) : ''

  return (
    <PaymentPageShell>
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
        <PaymentErrorPanel
          code={errorCode}
          onRetry={errorCode === 'server' || errorCode === 'rate_limited' ? handleRetry : undefined}
        />
      )}

      {(state === 'ready' || state === 'redirecting') && view && (
        <QuotePayCard
          view={view}
          dueTodayFormatted={dueTodayFormatted}
          language={i18n.language}
          redirecting={state === 'redirecting'}
          showCanceledNotice={returnStatus === 'canceled'}
          onPay={handlePay}
        />
      )}

      {state === 'confirming' && (
        <PaymentConfirmingPanel pollExhausted={pollExhausted} onRefresh={handleManualRefresh} />
      )}

      {state === 'paid' && view && (
        <PaymentPaidPanel
          orgName={view.orgName}
          amountFormatted={dueTodayFormatted}
          paidAt={view.paidAt}
        />
      )}
    </PaymentPageShell>
  )
}

interface QuotePayCardProps {
  view: PublicQuoteView
  dueTodayFormatted: string
  language: string
  redirecting: boolean
  showCanceledNotice: boolean
  onPay: () => void
}

function QuotePayCard({
  view,
  dueTodayFormatted,
  language,
  redirecting,
  showCanceledNotice,
  onPay,
}: QuotePayCardProps) {
  const { t } = useTranslation()

  return (
    <section className="flex-1 py-2 sm:py-4">
      <div className="mx-auto grid w-full max-w-5xl items-start gap-8 lg:grid-cols-[1fr_minmax(380px,420px)] lg:gap-12">
        <div className="order-2 lg:order-1">
          <QuoteIntroPanel orgName={view.orgName} recipientFirstName={view.recipientFirstName} />
        </div>

        <div className="order-1 lg:order-2 lg:sticky lg:top-24">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <div className="px-5 py-5 sm:px-6 sm:py-6">
              {showCanceledNotice && (
                <div
                  className="mb-5 flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3 text-left text-sm text-muted-foreground"
                  role="status"
                >
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{t('pay.canceledNotice')}</span>
                </div>
              )}

              <QuoteBreakdown view={view} language={language} />

              <Button
                onClick={onPay}
                disabled={redirecting}
                size="lg"
                className="mt-6 min-h-12 w-full gap-2 text-base font-semibold shadow-md shadow-primary/20"
              >
                {redirecting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                    {t('pay.redirecting')}
                  </>
                ) : (
                  <>
                    <CreditCard className="h-5 w-5" aria-hidden="true" />
                    {t('pay.payButton', { amount: dueTodayFormatted })}
                  </>
                )}
              </Button>

              <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                {t('pay.stripeNote')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
