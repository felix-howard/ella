/**
 * Ready-state card for the portal pay page: org name, description, amount,
 * and the Pay button that kicks off Stripe Checkout.
 */
import { useTranslation } from 'react-i18next'
import { CreditCard, Info, Loader2, Lock } from 'lucide-react'
import { Button } from '@ella/ui'
import type { PublicPaymentView } from '../../lib/payment-api'

interface PaymentPayCardProps {
  view: PublicPaymentView
  amountFormatted: string
  /** True while the checkout session is being created / browser is redirecting. */
  redirecting: boolean
  /** True when the client came back from Stripe with ?status=canceled. */
  showCanceledNotice: boolean
  onPay: () => void
}

export function PaymentPayCard({
  view,
  amountFormatted,
  redirecting,
  showCanceledNotice,
  onPay,
}: PaymentPayCardProps) {
  const { t } = useTranslation()

  return (
    <section className="flex-1 flex items-center justify-center py-8">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border bg-muted/30 px-6 py-5 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {view.organizationName}
          </p>
          {view.clientFirstName && (
            <p className="mt-2 text-base text-foreground">
              {t('pay.greeting', { firstName: view.clientFirstName })}
            </p>
          )}
        </div>

        <div className="px-6 py-7 text-center sm:px-8">
          {showCanceledNotice && (
            <div
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-4 py-3 text-left text-sm text-muted-foreground"
              role="status"
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t('pay.canceledNotice')}</span>
            </div>
          )}

          {view.description && (
            <p className="text-sm font-medium text-muted-foreground sm:text-base">
              {view.description}
            </p>
          )}
          <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {amountFormatted}
          </p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('pay.amountLabel')}
          </p>

          <Button
            onClick={onPay}
            disabled={redirecting}
            size="lg"
            className="mt-7 min-h-12 w-full gap-2 text-base font-semibold shadow-md shadow-primary/20"
          >
            {redirecting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                {t('pay.redirecting')}
              </>
            ) : (
              <>
                <CreditCard className="h-5 w-5" aria-hidden="true" />
                {t('pay.payButton', { amount: amountFormatted })}
              </>
            )}
          </Button>

          <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
            {t('pay.stripeNote')}
          </p>
        </div>
      </div>
    </section>
  )
}
