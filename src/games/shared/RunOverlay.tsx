import type { ReactNode } from 'react'
import './run.css'

type Panel = { title: string; text: ReactNode; action: string; onAction: () => void }

/**
 * The cover over a game board before it starts, after it ends, and while it is paused. `className` is the game's own overlay
 * class, so each game keeps its look. The three panels are plain data so the wording stays with the game.
 */
export function RunOverlay({ className, phase, paused, onResume, ready, over }: {
  className: string
  phase: 'ready' | 'playing' | 'over'
  paused: boolean
  onResume: () => void
  ready: Panel
  over: Panel
}) {
  if (phase === 'playing' && !paused) return null
  const panel: Panel = paused ? { title: 'Paused', text: 'Press P or Escape, or tap Resume, to carry on.', action: 'Resume', onAction: onResume } : phase === 'ready' ? ready : over
  return (
    <div className={className} role="status">
      <strong>{panel.title}</strong>
      <span>{panel.text}</span>
      <button type="button" className="primary-btn" onClick={panel.onAction}>{panel.action}</button>
    </div>
  )
}

/** A small Pause button for a game's stats row; only offered while a run is going. */
export function PauseButton({ phase, paused, onPause }: { phase: 'ready' | 'playing' | 'over'; paused: boolean; onPause: () => void }) {
  if (phase !== 'playing' || paused) return null
  return <button type="button" className="run-pause" aria-label="Pause" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') e.stopPropagation() }} onClick={onPause}>Pause</button>
}
