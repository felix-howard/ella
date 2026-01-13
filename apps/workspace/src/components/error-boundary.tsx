/**
 * Error Boundary component
 * Catches unhandled errors and displays fallback UI
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@ella/ui'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { UI_TEXT } from '../lib/constants'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const { errorBoundary } = UI_TEXT

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full bg-card rounded-xl border border-border p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-error-light flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-error" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-semibold text-foreground mb-2">
              {errorBoundary.title}
            </h1>
            <p className="text-muted-foreground mb-6">
              {errorBoundary.message}
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="text-left text-xs bg-muted p-3 rounded-lg mb-4 overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <Button onClick={this.handleRetry} className="gap-2">
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              {errorBoundary.retry}
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
