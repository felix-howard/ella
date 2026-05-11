/**
 * Welcome Header Component
 * Displays greeting with client name and tax year info
 * Mobile-first design with Ella mint green theme
 */
import { useTranslation } from 'react-i18next'
import { EllaLogoLight } from '@ella/ui'

interface WelcomeHeaderProps {
  clientName: string
  taxYear?: number
}

export function WelcomeHeader({ clientName, taxYear }: WelcomeHeaderProps) {
  const { t } = useTranslation()

  // Strip trailing " Group" so greetings read naturally for older clients.
  const displayName = clientName.replace(/\s+Group\s*$/i, '').trim() || clientName

  return (
    <header className="px-2 pt-10 pb-6 text-center sm:pt-12 lg:pt-14 lg:pb-8">
      <div className="mb-5 sm:mb-6">
        <img src={EllaLogoLight} alt="ella.tax" className="h-10 mx-auto object-contain sm:h-12" />
      </div>

      <h1 className="text-3xl font-semibold leading-tight tracking-normal text-foreground sm:text-4xl">
        {t('portal.welcome')} <span className="text-accent">{displayName}</span> 👋
      </h1>

      {taxYear && (
        <p className="mt-3 text-lg font-medium text-muted-foreground sm:text-xl">
          {t('portal.taxYear')} {taxYear}
        </p>
      )}
    </header>
  )
}
