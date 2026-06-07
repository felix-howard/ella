/**
 * Static page chrome (branded header + secure footer) for the portal payment
 * flow. Mirrors the agreement signing page shell so SMS'd clients get a
 * consistent look across sign and pay steps.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, ShieldCheck } from 'lucide-react'
import { EllaLogoLight, EllaLogoDark } from '@ella/ui'

export function PaymentPageShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation()

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
            <span>{t('pay.securePayment')}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto flex flex-col px-4 sm:px-6 lg:px-8 py-5 sm:py-7 lg:py-8">
        {children}
      </main>

      <footer className="border-t border-border bg-card/90 shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('pay.footerSecure')}</span>
          </div>
          <span className="font-medium">{t('nda.poweredBy')}</span>
        </div>
      </footer>
    </div>
  )
}
