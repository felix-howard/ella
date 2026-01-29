/**
 * Expense Form Page
 * Client-facing Schedule C expense collection via magic link
 */
import { useEffect, useState, useCallback, useRef, useMemo, lazy, Suspense } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { Button, EllaLogoLight } from '@ella/ui'
import { ApiError } from '../../../lib/api-client'
import { expenseApi, type ExpenseFormData } from '../../../features/expense/lib/expense-api'
import { ExpenseErrorBoundary } from '../../../features/expense/components/expense-error-boundary'

// Lazy load ExpenseForm (heaviest component with 20+ fields, hooks, sections)
const ExpenseForm = lazy(() => import('../../../features/expense/components/expense-form').then(m => ({ default: m.ExpenseForm })))

export const Route = createFileRoute('/expense/$token/')({
  component: ExpenseFormPage,
})

type PageState = 'loading' | 'success' | 'error'

interface ErrorState {
  code: string
  message: string
}

function ExpenseFormPage() {
  const { token } = Route.useParams()

  const [state, setState] = useState<PageState>('loading')
  const [data, setData] = useState<ExpenseFormData | null>(null)
  const [error, setError] = useState<ErrorState | null>(null)

  // Ref to track if component is mounted
  const isMountedRef = useRef(true)

  // Initial data load
  useEffect(() => {
    isMountedRef.current = true

    async function fetchData() {
      setState('loading')
      setError(null)

      try {
        const result = await expenseApi.getData(token)
        if (isMountedRef.current) {
          setData(result)
          setState('success')
        }
      } catch (err) {
        if (isMountedRef.current) {
          setState('error')
          if (err instanceof ApiError) {
            setError({ code: err.code, message: err.message })
          } else {
            setError({
              code: 'UNKNOWN',
              message: 'Không thể tải dữ liệu. Vui lòng thử lại.',
            })
          }
        }
      }
    }

    fetchData()
    return () => {
      isMountedRef.current = false
    }
  }, [token])

  // Reload handler
  const handleReload = useCallback(() => {
    if (!isMountedRef.current) return

    setState('loading')
    setError(null)
    expenseApi
      .getData(token)
      .then((result) => {
        if (isMountedRef.current) {
          setData(result)
          setState('success')
        }
      })
      .catch((err) => {
        if (isMountedRef.current) {
          setState('error')
          if (err instanceof ApiError) {
            setError({ code: err.code, message: err.message })
          } else {
            setError({
              code: 'UNKNOWN',
              message: 'Không thể tải dữ liệu. Vui lòng thử lại.',
            })
          }
        }
      })
  }, [token])

  // Loading state
  if (state === 'loading') {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        role="status"
        aria-label="Đang tải..."
      >
        <div className="text-center">
          <Loader2
            className="w-10 h-10 text-primary animate-spin mx-auto mb-4"
            aria-hidden="true"
          />
          <p className="text-muted-foreground">Đang tải form chi phí...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (state === 'error' || !data) {
    return <ErrorView error={error} onRetry={handleReload} />
  }

  // Success state
  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <img
            src={EllaLogoLight}
            alt="Ella Tax"
            className="w-10 h-10"
          />
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Form Chi Phí Kinh Doanh
            </h1>
            <p className="text-sm text-muted-foreground">
              Năm thuế {data.taxYear}
            </p>
          </div>
        </div>

        {/* Client greeting */}
        <p className="text-sm text-muted-foreground">
          Xin chào{' '}
          <span className="font-medium text-accent">{data.client.name}</span>!
          Vui lòng điền các chi phí kinh doanh của bạn bên dưới.
        </p>
      </header>

      {/* Form with error boundary (lazy loaded) */}
      <ExpenseErrorBoundary>
        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        }>
          <ExpenseForm token={token} initialData={data} />
        </Suspense>
      </ExpenseErrorBoundary>

      {/* Footer */}
      <footer className="px-6 py-4 text-center mt-auto">
        <p className="text-xs text-muted-foreground">
          Câu hỏi? Liên hệ CPA của bạn
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Ella Tax Document System
        </p>
      </footer>
    </div>
  )
}

// Error view component
function ErrorView({
  error,
  onRetry,
}: {
  error: ErrorState | null
  onRetry: () => void
}) {
  const isInvalidLink = useMemo(
    () =>
      error?.code === 'INVALID_TOKEN' ||
      error?.code === 'INVALID_TOKEN_TYPE' ||
      error?.code === 'EXPIRED_TOKEN' ||
      error?.code === 'LINK_DEACTIVATED',
    [error?.code]
  )

  return (
    <div
      className="flex-1 flex items-center justify-center p-6"
      role="alert"
      aria-live="polite"
    >
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-error" aria-hidden="true" />
        </div>

        <h2 className="text-xl font-semibold text-foreground mb-2">
          {isInvalidLink ? 'Link không hợp lệ' : 'Không thể tải dữ liệu'}
        </h2>

        <p className="text-muted-foreground mb-6">
          {error?.message || 'Vui lòng liên hệ văn phòng thuế để được hỗ trợ.'}
        </p>

        {!isInvalidLink && (
          <Button onClick={onRetry} className="gap-2" aria-label="Thử lại">
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Thử lại
          </Button>
        )}

        {isInvalidLink && (
          <p className="text-sm text-muted-foreground">
            Vui lòng liên hệ CPA để được gửi link mới.
          </p>
        )}
      </div>
    </div>
  )
}
