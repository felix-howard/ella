/**
 * Portal Home/Landing Page
 * Redirects to magic link or shows error for direct access
 */
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { EllaLogoLight } from '@ella/ui'

export const Route = createFileRoute('/')({
  component: PortalHomePage,
})

function PortalHomePage() {
  const { t } = useTranslation()

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      {/* Logo */}
      <div className="mb-8">
        <img src={EllaLogoLight} alt="Ella" className="h-16 mx-auto object-contain" />
      </div>

      {/* Message */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-foreground mb-2">
          Ella Portal
        </h1>
        <p className="text-muted-foreground max-w-xs">
          {t('portal.landingMessage')}
        </p>
      </div>

      {/* Footer */}
      <footer className="text-xs text-muted-foreground">
        {t('footer.copyright')}
      </footer>
    </main>
  )
}
