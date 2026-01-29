/**
 * Welcome Header Component
 * Displays greeting with client name and tax year info
 * Mobile-first design with Ella mint green theme
 */
import { EllaLogoLight } from '@ella/ui'
import { getText, type Language } from '../../lib/i18n'

interface WelcomeHeaderProps {
  clientName: string
  language: Language
  taxYear?: number
}

export function WelcomeHeader({ clientName, language, taxYear }: WelcomeHeaderProps) {
  const t = getText(language)

  return (
    <header className="px-6 pt-8 pb-6 text-center">
      {/* Ella Logo */}
      <div className="mb-6">
        <img src={EllaLogoLight} alt="ella.tax" className="h-10 mx-auto object-contain" />
      </div>

      {/* Greeting */}
      <h1 className="text-2xl font-semibold text-foreground">
        {t.welcome}, <span className="text-accent">{clientName}</span>!
      </h1>

      {/* Tax Year Badge */}
      {taxYear && (
        <p className="mt-2 text-sm text-muted-foreground">
          {language === 'VI' ? `Năm thuế ${taxYear}` : `Tax Year ${taxYear}`}
        </p>
      )}
    </header>
  )
}
