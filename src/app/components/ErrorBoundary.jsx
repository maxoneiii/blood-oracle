import { Component } from 'react'

/**
 * Catches a render failure and shows it.
 *
 * Without this, a thrown error unmounts the whole tree and Foundry redraws an
 * empty sheet — which looks like the interface flickering rather than like a
 * bug, and leaves nothing on screen to report.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Blood Oracle | Sheet render failed', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="bo-app" style={{ padding: '20px' }}>
        <h2 className="bo-section-title">Something went wrong</h2>
        <p className="bo-prose" style={{ marginTop: '10px' }}>
          The sheet could not be drawn. The full error is in the browser console.
        </p>
        <pre className="bo-error-detail">{String(this.state.error?.message ?? this.state.error)}</pre>
        <button
          type="button"
          className="bo-ghost is-accent"
          onClick={() => this.setState({ error: null })}
        >
          Try again
        </button>
      </div>
    )
  }
}
