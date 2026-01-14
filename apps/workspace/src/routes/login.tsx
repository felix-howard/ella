/**
 * Login page for Ella Workspace
 * Custom styled login matching Ella's mint green design
 */
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSignIn, useAuth } from '@clerk/clerk-react'
import { useState, useEffect } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { EllaLogoDark } from '@ella/ui'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const { isSignedIn, isLoaded } = useAuth()
  const { signIn, setActive } = useSignIn()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Redirect to home if already signed in
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate({ to: '/' })
    }
  }, [isLoaded, isSignedIn, navigate])

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
        await setActive({ session: result.createdSessionId })
        navigate({ to: '/' })
      } else {
        setError('Đăng nhập không thành công. Vui lòng thử lại.')
      }
    } catch (err: unknown) {
      const clerkError = err as { errors?: Array<{ message?: string }> }
      const errorMessage = clerkError.errors?.[0]?.message || 'Đăng nhập không thành công. Vui lòng thử lại.'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // Show loading while checking auth state
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#1a1f2e] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1a1f2e] flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-10">
        <img
          src={EllaLogoDark}
          alt="ella.tax"
          className="h-10 object-contain"
        />
      </div>

      {/* Login Form Card */}
      <div className="w-full max-w-[calc(28rem-40px)]">
        <form onSubmit={handleSubmit} className="space-y-0">
          {/* Email Input */}
          <div className="relative">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full px-4 py-4 bg-[#2d3446] text-white placeholder-gray-400 rounded-t-lg border-b border-[#3d4556] focus:outline-none autofill:bg-[#2d3446] autofill:text-white [&:-webkit-autofill]:bg-[#2d3446] [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:[box-shadow:0_0_0_1000px_#2d3446_inset]"
              disabled={isLoading}
            />
          </div>

          {/* Password Input */}
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mật khẩu"
              required
              className="w-full px-4 py-4 bg-[#2d3446] text-white placeholder-gray-400 rounded-b-lg focus:outline-none pr-12 autofill:bg-[#2d3446] autofill:text-white [&:-webkit-autofill]:bg-[#2d3446] [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:[box-shadow:0_0_0_1000px_#2d3446_inset]"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-3 text-sm text-red-400 text-center">
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
                Đang đăng nhập...
              </>
            ) : (
              'Đăng nhập'
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
              alert('Tính năng đang phát triển')
            }}
          >
            Quên mật khẩu?
          </button>
        </div>
      </div>
    </div>
  )
}
