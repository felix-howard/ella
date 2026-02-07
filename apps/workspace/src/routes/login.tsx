/**
 * Login page for Ella Workspace
 * Custom styled login matching Ella's mint green design
 * Supports both light and dark themes
 * Handles pending sessions with choose-organization task
 */
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSignIn, useAuth, useClerk, useOrganizationList } from '@clerk/clerk-react'
import { useState, useEffect } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { EllaLogoDark, EllaLogoLight } from '@ella/ui'
import { useTheme } from '../stores/ui-store'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const { isSignedIn, isLoaded } = useAuth()
  const { signIn, setActive } = useSignIn()
  const clerk = useClerk()
  const { userMemberships, isLoaded: isOrgListLoaded } = useOrganizationList({
    userMemberships: { infinite: true },
  })
  const navigate = useNavigate()
  const { theme } = useTheme()
  const { t } = useTranslation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // 2FA state
  const [needs2FA, setNeeds2FA] = useState(false)
  const [twoFactorCode, setTwoFactorCode] = useState('')

  // Select logo based on theme
  const logo = theme === 'dark' ? EllaLogoDark : EllaLogoLight

  // Redirect to home if already signed in
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate({ to: '/' })
    }
  }, [isLoaded, isSignedIn, navigate])

  // Handle pending session with choose-organization task:
  // After login + 2FA, session is created but stays "pending" until org is selected.
  // Clerk's isSignedIn returns false for pending sessions, so user lands back on login.
  // This effect detects that pending session and completes the org selection.
  useEffect(() => {
    if (!isLoaded || isSignedIn || !isOrgListLoaded) return

    const pendingSession = clerk.client?.sessions?.find(
      (s) => s.status === 'pending'
    )
    if (!pendingSession) return

    const firstOrgId = userMemberships?.data?.[0]?.organization.id
    if (!firstOrgId) return

    // Complete the pending session by setting org
    // Navigation handled by useEffect watching isSignedIn
    clerk.setActive({
      session: pendingSession.id,
      organization: firstOrgId,
    }).catch(() => {
      // If setActive fails, sign out to clear the stuck session
      clerk.signOut()
    })
  }, [isLoaded, isSignedIn, isOrgListLoaded, clerk, userMemberships?.data])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signIn) return

    setError('')
    setIsLoading(true)

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      })

      if (result.status === 'complete') {
        const firstOrgId = userMemberships?.data?.[0]?.organization.id
        await setActive({
          session: result.createdSessionId,
          organization: firstOrgId,
        })
        // Don't navigate or reset loading — the useEffect watching isSignedIn
        // will navigate after Clerk's auth state fully updates and token is verified.
        // Keep isLoading=true so login button keeps spinning until redirect.
        return
      } else if (result.status === 'needs_second_factor') {
        // User has 2FA enabled - prepare email code and show 2FA input
        const secondFactor = result.supportedSecondFactors?.find(
          (f: { strategy: string }) => f.strategy === 'email_code'
        )
        if (secondFactor) {
          await signIn.prepareSecondFactor({
            strategy: 'email_code',
          })
        }
        setNeeds2FA(true)
      } else {
        setError(t('login.loginFailed'))
      }
    } catch (err: unknown) {
      const clerkError = err as { errors?: Array<{ code?: string; message?: string }> }
      const firstErr = clerkError.errors?.[0]

      // Handle "Session already exists" - complete the pending session
      if (firstErr?.code === 'session_exists') {
        const firstOrgId = userMemberships?.data?.[0]?.organization.id
        const pendingSession = clerk.client?.sessions?.find(
          (s) => s.status === 'pending'
        )
        if (pendingSession && firstOrgId) {
          try {
            await clerk.setActive({
              session: pendingSession.id,
              organization: firstOrgId,
            })
            // Don't navigate — useEffect watching isSignedIn will handle it
            // Keep isLoading=true until redirect
            return
          } catch {
            // If that fails too, sign out to reset
            await clerk.signOut()
          }
        }
      }

      const errorMessage = firstErr?.message || t('login.loginFailed')
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle 2FA code submission
  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signIn) return

    setError('')
    setIsLoading(true)

    try {
      const result = await signIn.attemptSecondFactor({
        strategy: 'email_code',
        code: twoFactorCode,
      })

      if (result.status === 'complete') {
        const firstOrgId = userMemberships?.data?.[0]?.organization.id
        await setActive({
          session: result.createdSessionId,
          organization: firstOrgId,
        })
        // Don't navigate here — the useEffect watching isSignedIn will handle it
        // Keep isLoading=true until redirect
        return
      } else {
        setError(t('login.verificationFailed'))
      }
    } catch (err: unknown) {
      const clerkError = err as { errors?: Array<{ message?: string }> }
      const errorMessage = clerkError.errors?.[0]?.message || t('login.codeIncorrect')
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // Show loading while checking auth state or resolving pending session
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-10">
        <img
          src={logo}
          alt="ella.tax"
          className="h-10 object-contain"
        />
      </div>

      {/* Login Form Card */}
      <div className="w-full max-w-[calc(28rem-40px)]">
        {needs2FA ? (
          // 2FA Verification Form
          <form onSubmit={handle2FASubmit} className="space-y-0">
            <div className="text-center mb-6">
              <p className="text-muted-foreground text-sm">
                {t('login.enterCodeFromEmail')}
              </p>
            </div>

            {/* 2FA Code Input */}
            <div className="relative">
              <input
                type="text"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={t('login.enterCodePlaceholder')}
                required
                autoFocus
                className="w-full px-4 py-4 bg-card text-foreground placeholder-muted-foreground border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-center text-2xl tracking-widest"
                disabled={isLoading}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-3 text-sm text-error text-center">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || twoFactorCode.length !== 6}
              className="w-full mt-6 py-4 bg-primary hover:bg-primary-dark text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('login.verifying')}
                </>
              ) : (
                t('login.confirmButton')
              )}
            </button>

            {/* Back to Login */}
            <div className="mt-4 text-center">
              <button
                type="button"
                className="text-primary hover:text-primary-dark transition-colors text-sm"
                onClick={() => {
                  setNeeds2FA(false)
                  setTwoFactorCode('')
                  setError('')
                }}
              >
                {t('login.backToLogin')}
              </button>
            </div>
          </form>
        ) : (
          // Login Form
          <>
            <form onSubmit={handleSubmit} className="space-y-0">
              {/* Email Input */}
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('login.emailPlaceholder')}
                  required
                  className="w-full px-4 py-4 bg-card text-foreground placeholder-muted-foreground rounded-t-lg border border-input border-b-0 focus:outline-none focus:ring-2 focus:ring-primary focus:relative focus:z-10"
                  disabled={isLoading}
                />
              </div>

              {/* Password Input */}
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('login.passwordPlaceholder')}
                  required
                  className="w-full px-4 py-4 bg-card text-foreground placeholder-muted-foreground rounded-b-lg border border-input focus:outline-none focus:ring-2 focus:ring-primary pr-12"
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

              {/* Error Message */}
              {error && (
                <div className="mt-3 text-sm text-error text-center">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-6 py-4 bg-primary hover:bg-primary-dark text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('login.loggingIn')}
                  </>
                ) : (
                  t('login.loginButton')
                )}
              </button>
            </form>

            {/* Forgot Password Link */}
            <div className="mt-4 text-center">
              <button
                type="button"
                className="text-primary hover:text-primary-dark transition-colors text-sm"
                onClick={() => {
                  // TODO: Implement forgot password flow
                  alert(t('login.featureInDevelopment'))
                }}
              >
                {t('login.forgotPassword')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
