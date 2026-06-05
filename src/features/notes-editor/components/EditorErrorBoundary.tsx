import { Component } from 'react'
import type { ReactNode } from 'react'

interface EditorErrorBoundaryProps {
  children: ReactNode
  fallback: (errorMessage: string | null) => ReactNode
  resetKey: string
}

interface EditorErrorBoundaryState {
  hasError: boolean
  errorMessage: string | null
}

export class EditorErrorBoundary extends Component<EditorErrorBoundaryProps, EditorErrorBoundaryState> {
  state: EditorErrorBoundaryState = {
    hasError: false,
    errorMessage: null,
  }

  static getDerivedStateFromError(): EditorErrorBoundaryState {
    return { hasError: true, errorMessage: null }
  }

  componentDidCatch(error: unknown): void {
    const message =
      error instanceof Error
        ? error.stack ?? error.message
        : typeof error === 'string'
          ? error
          : 'Unknown editor error'

    this.setState({ errorMessage: message })
  }

  componentDidUpdate(prevProps: EditorErrorBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, errorMessage: null })
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback(this.state.errorMessage)
    }

    return this.props.children
  }
}
