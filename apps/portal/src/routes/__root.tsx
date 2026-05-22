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
    localStorage.setItem('ella-language', newLang)
    i18n.changeLanguage(newLang)
  }

  return (
    <button
      onClick={toggleLanguage}
      className="fixed top-4 right-4 z-50 rounded-full border border-white/80 bg-white/80 px-4 py-2 text-sm font-semibold text-muted-foreground shadow-sm backdrop-blur-md transition hover:-translate-y-0.5 hover:border-primary/30 hover:text-foreground hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label="Switch language"
    >
      {isVi ? 'English' : 'Vietnamese'}
    </button>
  )
}

function PortalLayout() {
  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_20%_0%,rgba(16,185,129,0.10),transparent_30%),linear-gradient(180deg,#F8FBFD_0%,#EEF3F8_45%,#EAF0F6_100%)]">
      <LanguageToggle />
      <div className="mx-auto min-h-dvh max-w-5xl flex flex-col px-4 sm:px-6 lg:px-8">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </div>
      <ToastContainer />
    </div>
  )
}
