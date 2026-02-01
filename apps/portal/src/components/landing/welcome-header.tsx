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
  const { t, i18n } = useTranslation()

  return (
    <header className="px-6 pt-8 pb-6 text-center relative">
      {/* Language toggle - top right */}
      <button
        onClick={() => i18n.changeLanguage(i18n.language === 'vi' ? 'en' : 'vi')}
        className="absolute top-8 right-6 px-3 py-1 text-xs font-medium rounded-full border border-border bg-muted hover:bg-muted/80 transition-colors"
      >
        {i18n.language === 'vi' ? 'EN' : 'VI'}
      </button>

      {/* Ella Logo */}
      <div className="mb-6">
        <img src={EllaLogoLight} alt="ella.tax" className="h-10 mx-auto object-contain" />
      </div>

      {/* Greeting */}
      <h1 className="text-2xl font-semibold text-foreground">
        {t('portal.welcome')}, <span className="text-accent">{clientName}</span>!
      </h1>

      {/* Tax Year Badge */}
      {taxYear && (
        <p className="mt-2 text-sm text-muted-foreground">
          {t('portal.taxYear')} {taxYear}
        </p>
      )}
    </header>
  )
}
