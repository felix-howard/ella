/**
 * ExpenseErrorBoundary Component
 * Error boundary wrapper for expense form
 * Catches React render errors and shows fallback UI
 */
import { Component, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@ella/ui'

interface Props {
  children: ReactNode
  fallbackMessage?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ExpenseErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error for debugging
    console.error('Expense form error:', error, errorInfo)
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null })
  }

  handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <ExpenseErrorFallback
          error={this.state.error}
          fallbackMessage={this.props.fallbackMessage}
          onReload={this.handleReload}
          onRetry={this.handleRetry}
        />
      )
    }

    return this.props.children
  }
}

// eslint-disable-next-line react-refresh/only-export-components
function ExpenseErrorFallback({
  error,
  fallbackMessage,
  onReload,
  onRetry,
}: {
  error: Error | null
  fallbackMessage?: string
  onReload: () => void
  onRetry: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-warning" />
      </div>

      <h2 className="text-xl font-semibold text-foreground mb-2">{t('error.expense.title')}</h2>

      <p className="text-muted-foreground mb-6 max-w-sm">
        {fallbackMessage ?? t('error.expense.message')}
      </p>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onRetry} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          {t('error.boundary.retry')}
        </Button>

        <Button onClick={onReload}>{t('error.boundary.reload')}</Button>
      </div>

      {process.env.NODE_ENV === 'development' && error && (
        <details className="mt-6 text-left w-full max-w-md">
          <summary className="text-sm text-muted-foreground cursor-pointer">
            {t('error.expense.detailsDev')}
          </summary>
          <pre className="mt-2 p-3 bg-muted rounded-lg text-xs overflow-auto">
            {error.message}
            {'\n\n'}
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  )
}
