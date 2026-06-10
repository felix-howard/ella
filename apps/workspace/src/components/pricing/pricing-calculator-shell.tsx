import { useTranslation } from 'react-i18next'
import { Loader2, ShieldAlert } from 'lucide-react'
import { Button } from '@ella/ui'
import { PricingCalculatorPage } from './pricing-calculator-page'

interface PricingCalculatorShellProps {
  /** ADMIN can access payment and quote tools */
  canAccess: boolean
  isLoading: boolean
  hasRoleError: boolean
  onBackToDashboard: () => void
}

export function PricingCalculatorShell({
  canAccess,
  isLoading,
  hasRoleError,
  onBackToDashboard,
}: PricingCalculatorShellProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <section className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </section>
    )
  }

  if (hasRoleError) {
    return (
      <section className="flex flex-col items-center justify-center py-16 text-center">
        <ShieldAlert className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {t('pricingCalculator.roleErrorTitle')}
        </h3>
        <p className="text-sm text-muted-foreground max-w-md">
          {t('pricingCalculator.roleErrorDescription')}
        </p>
      </section>
    )
  }

  if (!canAccess) {
    return (
      <section className="flex flex-col items-center justify-center py-16 text-center">
        <ShieldAlert className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {t('pricingCalculator.noAccessTitle')}
        </h3>
        <p className="text-sm text-muted-foreground max-w-md">
          {t('pricingCalculator.noAccessDescription')}
        </p>
        <Button variant="outline" onClick={onBackToDashboard} className="mt-4">
          {t('nav.dashboard')}
        </Button>
      </section>
    )
  }

  return <PricingCalculatorPage />
}
