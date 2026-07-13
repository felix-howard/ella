/**
 * Ready-state card for public quote payments: quote breakdown and Stripe checkout CTA.
 */
import { useTranslation } from 'react-i18next'
import { AlertCircle, CreditCard, Info, Loader2, Lock } from 'lucide-react'
import { Button } from '@ella/ui'
import type { PublicQuoteView } from '../../lib/quote-api'
import { QuoteBreakdown } from './quote-breakdown'
import { QuoteIntroPanel } from './quote-intro-panel'

interface QuotePayCardProps {
  view: PublicQuoteView
  dueTodayFormatted: string
  language: string
  redirecting: boolean
  showCanceledNotice: boolean
  showFailedNotice: boolean
  onPay: () => void
}

export function QuotePayCard({
  view,
  dueTodayFormatted,
  language,
  redirecting,
  showCanceledNotice,
  showFailedNotice,
  onPay,
}: QuotePayCardProps) {
  const { t } = useTranslation()
  const payButtonLabel = showFailedNotice
    ? t('pay.tryPaymentAgain')
    : t('pay.payButton', { amount: dueTodayFormatted })

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

              {showFailedNotice && (
                <div
                  className="mb-5 flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-left text-sm text-muted-foreground"
                  role="status"
                >
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
                    aria-hidden="true"
                  />
                  <span>{t('pay.failedNotice')}</span>
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
                    {payButtonLabel}
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
