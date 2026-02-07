/**
 * Accept Invitation page
 * Handles Clerk organization invitation links with __clerk_ticket and __clerk_status params
 * - sign_in: existing user -> auto-sign-in with ticket
 * - sign_up: new user -> show name + password form, then sign up with ticket
 * Styled to match the login page
 */
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSignIn, useSignUp, useOrganizationList } from '@clerk/clerk-react'
import { useState, useEffect } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { EllaLogoDark, EllaLogoLight } from '@ella/ui'
import { useTheme } from '../stores/ui-store'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/accept-invitation')({
  component: AcceptInvitationPage,
})

function AcceptInvitationPage() {
  const navigate = useNavigate()
  const { theme } = useTheme()
  const { t } = useTranslation()

  const { signIn, setActive: setActiveSignIn } = useSignIn()
  const { isLoaded, signUp, setActive: setActiveSignUp } = useSignUp()
  const { userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  })

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSigningIn, setIsSigningIn] = useState(false)

  const logo = theme === 'dark' ? EllaLogoDark : EllaLogoLight

  // Extract ticket and status from URL
  const searchParams = new URLSearchParams(window.location.search)
  const ticket = searchParams.get('__clerk_ticket')
  const accountStatus = searchParams.get('__clerk_status')

  // Auto sign-in for existing users
  useEffect(() => {
    if (!signIn || !setActiveSignIn || !ticket || accountStatus !== 'sign_in') return

    setIsSigningIn(true)
    const doSignIn = async () => {
      try {
        const result = await signIn.create({
          strategy: 'ticket',
          ticket,
        })

        if (result.status === 'complete') {
          const firstOrgId = userMemberships?.data?.[0]?.organization.id
          await setActiveSignIn({
            session: result.createdSessionId,
            organization: firstOrgId,
          })
          // Full page reload to ensure Clerk session is fully propagated
          window.location.href = '/'
        } else {
          setError(t('invite.signInFailed'))
          setIsSigningIn(false)
        }
      } catch (err: unknown) {
        console.error('Sign-in with ticket failed:', err)
        const clerkError = err as { errors?: Array<{ message?: string }> }
        setError(clerkError.errors?.[0]?.message || t('invite.signInFailed'))
        setIsSigningIn(false)
      }
    }

    doSignIn()
  }, [signIn, setActiveSignIn, ticket, accountStatus, userMemberships?.data, t])

  // Handle sign-up form submission for new users
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoaded || !ticket) return

    setError('')
    setIsLoading(true)

    try {
      const result = await signUp.create({
        strategy: 'ticket',
        ticket,
        firstName,
        lastName,
        password,
      })

      if (result.status === 'complete') {
        await setActiveSignUp({
          session: result.createdSessionId,
        })
        // Full page reload to ensure Clerk session is fully propagated
        window.location.href = '/'
      } else {
        setError(t('invite.signUpFailed'))
      }
    } catch (err: unknown) {
      console.error('Sign-up with ticket failed:', err)
      const clerkError = err as { errors?: Array<{ message?: string }> }
      setError(clerkError.errors?.[0]?.message || t('invite.signUpFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  // No ticket in URL
  if (!ticket) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="mb-6 sm:mb-10">
          <img src={logo} alt="ella.tax" className="h-10 object-contain" />
        </div>
        <div className="w-full max-w-[calc(28rem-40px)] text-center">
          <p className="text-muted-foreground">{t('invite.noToken')}</p>
          <button
            className="mt-4 text-primary hover:text-primary-dark transition-colors text-sm"
            onClick={() => navigate({ to: '/login' })}
          >
            {t('invite.goToLogin')}
          </button>
        </div>
      </div>
    )
  }

  // Existing user auto-signing in
  if (isSigningIn) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="mb-6 sm:mb-10">
          <img src={logo} alt="ella.tax" className="h-10 object-contain" />
        </div>
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground text-sm">{t('invite.signingIn')}</p>
      </div>
    )
  }

  // New user sign-up form
  if (accountStatus === 'sign_up') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="mb-6 sm:mb-10">
          <img src={logo} alt="ella.tax" className="h-10 object-contain" />
        </div>

        <div className="w-full max-w-[calc(28rem-40px)]">
          <div className="text-center mb-6">
            <p className="text-muted-foreground text-sm">
              {t('invite.createAccount')}
            </p>
          </div>

          <form onSubmit={handleSignUp} className="space-y-0">
            {/* First Name */}
            <div className="relative">
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={t('invite.firstNamePlaceholder')}
                required
                className="w-full px-4 py-4 bg-card text-foreground text-base placeholder-muted-foreground rounded-t-lg border border-input border-b-0 focus:outline-none focus:ring-2 focus:ring-primary focus:relative focus:z-10"
                disabled={isLoading}
              />
            </div>

            {/* Last Name */}
            <div className="relative">
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={t('invite.lastNamePlaceholder')}
                required
                className="w-full px-4 py-4 bg-card text-foreground text-base placeholder-muted-foreground border border-input border-b-0 focus:outline-none focus:ring-2 focus:ring-primary focus:relative focus:z-10"
                disabled={isLoading}
              />
            </div>

            {/* Password */}
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('invite.passwordPlaceholder')}
                required
                className="w-full px-4 py-4 bg-card text-foreground text-base placeholder-muted-foreground rounded-b-lg border border-input focus:outline-none focus:ring-2 focus:ring-primary pr-12"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="mt-3 text-sm text-error text-center">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-6 py-4 bg-primary hover:bg-primary-dark text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('invite.creatingAccount')}
                </>
              ) : (
                t('invite.createButton')
              )}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Fallback: unknown status or sign_in with error displayed
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="mb-6 sm:mb-10">
        <img src={logo} alt="ella.tax" className="h-10 object-contain" />
      </div>
      <div className="w-full max-w-[calc(28rem-40px)] text-center">
        {error && (
          <div className="mb-4 text-sm text-error">{error}</div>
        )}
        <p className="text-muted-foreground text-sm">{t('invite.processing')}</p>
        <button
          className="mt-4 text-primary hover:text-primary-dark transition-colors text-sm"
          onClick={() => navigate({ to: '/login' })}
        >
          {t('invite.goToLogin')}
        </button>
      </div>
    </div>
  )
}
