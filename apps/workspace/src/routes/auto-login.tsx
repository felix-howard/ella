/**
 * Auto-login page for self-service signup
 * Consumes Clerk sign-in token from URL and activates session with organization
 */
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSignIn } from '@clerk/clerk-react'
import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { EllaLogoDark, EllaLogoLight } from '@ella/ui'
import { useTheme } from '../stores/ui-store'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/auto-login')({
  component: AutoLoginPage,
})

function AutoLoginPage() {
  const navigate = useNavigate()
  const { theme } = useTheme()
  const { t } = useTranslation()
  const { signIn, setActive } = useSignIn()

  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(true)

  const logo = theme === 'dark' ? EllaLogoDark : EllaLogoLight

  const searchParams = new URLSearchParams(window.location.search)
  const token = searchParams.get('token')
  const orgId = searchParams.get('orgId')

  useEffect(() => {
    // Guard: Only proceed if dependencies and params are ready
    if (!signIn || !setActive || !token || !orgId) {
      return
    }

    // Flag to track if component unmounted
    let mounted = true

    const doAutoLogin = async () => {
      try {
        const result = await signIn.create({
          strategy: 'ticket',
          ticket: token,
        })

        if (!mounted) return

        if (result.status === 'complete') {
          await setActive({
            session: result.createdSessionId,
            organization: orgId,
          })
          window.location.href = '/'
        } else {
          setError(t('autoLogin.signInFailed'))
          setIsProcessing(false)
        }
      } catch (err: unknown) {
        if (!mounted) return

        console.error('Auto-login failed:', err)
        const clerkError = err as { errors?: Array<{ code?: string; message?: string }> }
        const firstErr = clerkError.errors?.[0]

        if (firstErr?.code === 'sign_in_token_expired') {
          setError(t('autoLogin.tokenExpired'))
        } else {
          setError(firstErr?.message || t('autoLogin.signInFailed'))
        }
        setIsProcessing(false)
      }
    }

    doAutoLogin()

    return () => {
      mounted = false
    }
  }, [signIn, setActive, token, orgId, t])

  if (!token || !orgId) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="mb-6 sm:mb-10">
          <img src={logo} alt="ella.tax" className="h-10 object-contain" />
        </div>
        <div className="w-full max-w-[calc(28rem-40px)] text-center">
          <p className="text-muted-foreground">{t('autoLogin.invalidLink')}</p>
          <button
            className="mt-4 text-primary hover:text-primary-dark transition-colors text-sm"
            onClick={() => navigate({ to: '/login' })}
          >
            {t('autoLogin.goToLogin')}
          </button>
        </div>
      </div>
    )
  }

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="mb-6 sm:mb-10">
          <img src={logo} alt="ella.tax" className="h-10 object-contain" />
        </div>
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground text-sm">{t('autoLogin.signingIn')}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="mb-6 sm:mb-10">
        <img src={logo} alt="ella.tax" className="h-10 object-contain" />
      </div>
      <div className="w-full max-w-[calc(28rem-40px)] text-center">
        <div className="mb-4 text-sm text-error">{error}</div>
        <button
          className="text-primary hover:text-primary-dark transition-colors text-sm"
          onClick={() => navigate({ to: '/login' })}
        >
          {t('autoLogin.goToLogin')}
        </button>
      </div>
    </div>
  )
}
