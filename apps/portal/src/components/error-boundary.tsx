/**
 * Error Boundary Component
 * Catches React errors and displays fallback UI
 * Prevents entire app from crashing on component errors
 */
import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@ella/ui'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error for debugging (in production, send to error tracking service)
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return <ErrorFallback onReset={this.handleReset} />
    }

    return this.props.children
  }
}

// Default error fallback UI
function ErrorFallback({ onReset }: { onReset: () => void }) {
  return (
    <div
      className="flex-1 flex items-center justify-center p-6"
      role="alert"
      aria-live="assertive"
    >
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-error" aria-hidden="true" />
        </div>

        <h2 className="text-xl font-semibold text-foreground mb-2">
          Đã xảy ra lỗi
        </h2>

        <p className="text-muted-foreground mb-6">
          Có lỗi xảy ra. Vui lòng thử lại hoặc tải lại trang.
        </p>

        <div className="space-y-3">
          <Button onClick={onReset} className="w-full gap-2">
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Thử lại
          </Button>

          <Button
            variant="ghost"
            onClick={() => window.location.reload()}
            className="w-full"
          >
            Tải lại trang
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ErrorBoundary
