import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from './ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Shown in the error UI heading. Defaults to "Something went wrong" */
  title?: string
  /** If true, renders a compact inline fallback instead of a full-page one */
  inline?: boolean
  /** Optional custom fallback renderer */
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  reset = () => {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset)
    }

    if (this.props.inline) {
      return (
        <div
          data-testid="error-boundary-fallback"
          role="alert"
          className="rounded-lg border border-destructive/50 bg-destructive/10 p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h3 className="text-sm font-semibold text-destructive">
              {this.props.title ?? 'Something went wrong'}
            </h3>
          </div>
          <p className="text-xs text-destructive-foreground mb-3">
            {error.message || 'An unexpected error occurred'}
          </p>
          <Button
            data-testid="error-boundary-retry"
            variant="outline"
            size="sm"
            onClick={this.reset}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </div>
      )
    }

    return (
      <div
        data-testid="error-boundary-fallback"
        role="alert"
        className="min-h-screen bg-background flex items-center justify-center p-6"
      >
        <div className="max-w-md w-full p-6 rounded-lg border border-destructive/50 bg-destructive/10">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <h2 className="text-xl font-semibold text-destructive">
              {this.props.title ?? 'Something went wrong'}
            </h2>
          </div>
          <p className="text-sm text-destructive-foreground mb-6">
            {error.message || 'An unexpected error occurred'}
          </p>
          <div className="flex gap-3">
            <Button
              data-testid="error-boundary-retry"
              variant="outline"
              onClick={this.reset}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try again
            </Button>
            <Button
              variant="destructive"
              onClick={() => window.location.reload()}
            >
              Reload page
            </Button>
          </div>
        </div>
      </div>
    )
  }
}
