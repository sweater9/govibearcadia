import { Component, type ErrorInfo, type ReactNode } from 'react'

type State = { failed: boolean }

/** Catches a game chunk that fails to load (for example, first visit while offline). */
export class GameBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Game failed to load', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="game-over" role="alert">
        <h3>Game unavailable</h3>
        <p>This game could not load. If you are offline, reconnect once so it can be saved to your device.</p>
        <button className="primary-btn" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    )
  }
}
