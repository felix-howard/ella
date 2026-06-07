/**
 * Public deposit payment page, mounted at portal `/pay/:payToken`.
 *
 * State machine:
 *   loading     -> ready | paid | error(invalid|canceled|server|rate_limited)
 *   ready       -> redirecting (POST checkout -> Stripe Checkout URL)
 *   confirming  -> paid (webhook landed) | ready (FAILED) | error (CANCELED)
 *                  | stays confirming w/ manual refresh once polling is exhausted
 *
 * Returning from Stripe with ?status=success enters `confirming` — the page
 * polls until the webhook marks the Payment PAID, then shows the thank-you
 * panel. ?status=canceled re-enters `ready` with a notice.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { ApiError } from '../../lib/api-client'
import { paymentApi, formatPaymentAmount, type PublicPaymentView } from '../../lib/payment-api'
import { toast } from '../../lib/toast-store'
import { PaymentPageShell } from './payment-page-shell'
import { PaymentPayCard } from './payment-pay-card'
import {
  PaymentPaidPanel,
  PaymentConfirmingPanel,
  PaymentErrorPanel,
  type PaymentErrorCode,
} from './payment-result-panels'

type PageState = 'loading' | 'ready' | 'redirecting' | 'confirming' | 'paid' | 'error'

// Webhook lag after Stripe redirect is usually seconds; poll briefly, then
// fall back to a manual "Check again" button rather than polling forever.
const POLL_INTERVAL_MS = 3000
const MAX_POLL_ATTEMPTS = 5

function mapLoadError(err: unknown): PaymentErrorCode {
  if (!(err instanceof ApiError)) return 'server'
  if (err.status === 404) return 'invalid'
  if (err.status === 429) return 'rate_limited'
  return 'server'
}

interface PaymentPayPageProps {
  payToken: string
  /** Stripe return query param: 'success' | 'canceled' | undefined. */
  returnStatus?: 'success' | 'canceled'
}

export function PaymentPayPage({ payToken, returnStatus }: PaymentPayPageProps) {
  const { t, i18n } = useTranslation()

  const [state, setState] = useState<PageState>('loading')
  const [view, setView] = useState<PublicPaymentView | null>(null)
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
    (data: PublicPaymentView, opts: { confirming: boolean }) => {
      setView(data)
      if (data.status === 'PAID' || data.status === 'REFUNDED') {
        setState('paid')
      } else if (data.status === 'CANCELED') {
        setErrorCode('canceled')
        setState('error')
      } else if (opts.confirming && data.status !== 'FAILED') {
        // Back from Stripe but webhook hasn't landed yet (PENDING)
        setState('confirming')
      } else {
        // PENDING fresh visit, or FAILED (card declined) — payable again
        setState('ready')
      }
    },
    [],
  )

  // Initial load (+ reloads after 409s / retry button)
  useEffect(() => {
    let mounted = true
    paymentApi
      .getPayment(payToken)
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

  // Confirming: poll until a terminal status or attempts run out. A state
  // change inside applyViewState re-runs this effect, whose cleanup clears
  // the interval — no manual clear needed on those paths.
  useEffect(() => {
    if (state !== 'confirming') return
    let cancelled = false
    let attempts = 0
    const timer = setInterval(async () => {
      attempts += 1
      try {
        const data = await paymentApi.getPayment(payToken)
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
      const { checkoutUrl } = await paymentApi.createCheckout(payToken)
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

  const amountFormatted = view ? formatPaymentAmount(view.amount, view.currency, i18n.language) : ''

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
        <PaymentPayCard
          view={view}
          amountFormatted={amountFormatted}
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
          orgName={view.organizationName}
          amountFormatted={amountFormatted}
          paidAt={view.paidAt}
        />
      )}
    </PaymentPageShell>
  )
}
