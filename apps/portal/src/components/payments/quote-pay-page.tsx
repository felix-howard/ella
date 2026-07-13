/**
 * Public sent-quote pay page, mounted at portal `/quote/:payToken`.
 *
 * Mirrors the deposit pay page state machine, but renders an itemized quote
 * breakdown and pays via the `/public/quote` endpoints (one-time or recurring
 * subscription, decided server-side from the frozen snapshot).
 *
 *   loading     -> ready | paid | error(invalid|canceled|server|rate_limited)
 *   ready       -> redirecting (POST checkout -> Stripe Checkout URL)
 *   confirming  -> paid (webhook landed) | bank processing | ready
 *
 * Returning from Stripe with ?status=success enters `confirming`, polling until
 * the webhook settles card payments. ACH returns render a bank-processing state
 * once the public quote state confirms settlement is pending.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { ApiError } from '../../lib/api-client'
import {
  quoteApi,
  formatQuoteAmount,
  isQuotePaymentProcessingError,
  getQuotePaymentStateFromError,
  type PublicQuoteView,
} from '../../lib/quote-api'
import { toast } from '../../lib/toast-store'
import { PaymentPageShell } from './payment-page-shell'
import { QuotePayCard } from './quote-pay-card'
import { refreshQuotePaymentStatus } from './quote-payment-status-refresh'
import {
  resolveQuotePaymentPageState,
  type QuotePaymentPageState,
} from './quote-payment-view-state'
import {
  PaymentBankProcessingPanel,
  PaymentPaidPanel,
  PaymentConfirmingPanel,
  PaymentErrorPanel,
  type PaymentErrorCode,
} from './payment-result-panels'

type PageState = QuotePaymentPageState

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
  const [checkingBankStatus, setCheckingBankStatus] = useState(false)
  const redirectingRef = useRef(false)
  const checkingBankStatusRef = useRef(false)

  const handleRetry = useCallback(() => {
    setState('loading')
    setReloadCounter((n) => n + 1)
  }, [])

  /** Route a fetched view to the page state it implies. Shared by load + poll. */
  const applyViewState = useCallback(
    (data: PublicQuoteView, opts: { confirming: boolean }) => {
      setView(data)
      const resolved = resolveQuotePaymentPageState(data, opts)
      if (resolved.errorCode) setErrorCode(resolved.errorCode)
      setState(resolved.pageState)
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

  const handleBankStatusRefresh = useCallback(async () => {
    if (checkingBankStatusRef.current) return
    checkingBankStatusRef.current = true
    setCheckingBankStatus(true)
    try {
      const data = await refreshQuotePaymentStatus(payToken)
      applyViewState(data, { confirming: false })
    } catch {
      toast.error(t('pay.bankProcessing.refreshError'))
    } finally {
      checkingBankStatusRef.current = false
      setCheckingBankStatus(false)
    }
  }, [payToken, applyViewState, t])

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
      if (isQuotePaymentProcessingError(err)) {
        const publicPaymentState = getQuotePaymentStateFromError(err)
        if (publicPaymentState) {
          setView((current) =>
            current ? { ...current, publicPaymentState } : current
          )
          setState(
            publicPaymentState.state === 'processing_bank_payment'
              ? 'processingBankPayment'
              : 'confirming'
          )
        } else {
          handleRetry()
        }
        return
      }
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
          showFailedNotice={view.publicPaymentState?.state === 'payment_failed'}
          onPay={handlePay}
        />
      )}

      {state === 'confirming' && (
        <PaymentConfirmingPanel pollExhausted={pollExhausted} onRefresh={handleManualRefresh} />
      )}

      {state === 'processingBankPayment' && (
        <PaymentBankProcessingPanel
          refreshing={checkingBankStatus}
          onRefresh={handleBankStatusRefresh}
        />
      )}

      {state === 'paid' && view && (
        <PaymentPaidPanel
          orgName={view.orgName}
          amountFormatted={dueTodayFormatted}
          paidAt={view.paidAt}
        />
      )}

      {state === 'subscriptionCanceledAfterPayment' && view && (
        <PaymentPaidPanel
          orgName={view.orgName}
          amountFormatted={dueTodayFormatted}
          paidAt={view.paidAt}
          variant="subscriptionCanceledAfterPayment"
        />
      )}
    </PaymentPageShell>
  )
}
