/**
 * Portal Root Layout
 * Mobile-first minimal layout for client document upload
 */
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ErrorBoundary } from '../components/error-boundary'
import { ToastContainer } from '../components/toast-container'

export const Route = createRootRoute({
  component: PortalLayout,
})

function LanguageToggle() {
  const { i18n } = useTranslation()
  const isVi = i18n.language === 'vi'

  const toggleLanguage = () => {
    const newLang = isVi ? 'en' : 'vi'
    i18n.changeLanguage(newLang)
  }

  return (
    <button
      onClick={toggleLanguage}
      className="fixed top-3 right-3 z-50 px-2.5 py-1 rounded-full bg-muted/80 backdrop-blur-sm text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border border-border/50"
      aria-label="Switch language"
    >
      {isVi ? 'EN' : 'VI'}
    </button>
  )
}

function PortalLayout() {
  return (
    <div className="min-h-dvh bg-background">
      <LanguageToggle />
      {/* Mobile-first container with safe area padding */}
      <div className="mx-auto max-w-lg min-h-dvh flex flex-col">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </div>
      <ToastContainer />
    </div>
  )
}
