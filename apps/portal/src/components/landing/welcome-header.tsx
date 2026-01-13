/**
 * Welcome Header Component
 * Displays greeting with client name and tax year info
 * Mobile-first design with Ella mint green theme
 */
import { getText, type Language } from '../../lib/i18n'

interface WelcomeHeaderProps {
  clientName: string
  taxYear: number
  language: Language
}

export function WelcomeHeader({ clientName, taxYear, language }: WelcomeHeaderProps) {
  const t = getText(language)

  return (
    <header className="px-6 pt-8 pb-6 text-center">
      {/* Ella Logo */}
      <div className="mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10">
          <span className="text-3xl font-bold text-primary">E</span>
        </div>
      </div>

      {/* Greeting */}
      <h1 className="text-2xl font-semibold text-foreground mb-1">
        {t.welcome}, <span className="text-accent">{clientName}</span>!
      </h1>

      {/* Tax Year Badge */}
      <div className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-primary/10 rounded-full">
        <span className="text-sm text-muted-foreground">{t.taxYear}</span>
        <span className="text-sm font-semibold text-primary">{taxYear}</span>
      </div>
    </header>
  )
}
