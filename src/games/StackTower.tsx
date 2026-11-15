import type { GameProps } from '../types'
import { PauseButton, RunOverlay } from './shared/RunOverlay'
import { useKeys, useRun } from './shared/useRun'
import { drop, floors, newGame, score, speedAt, step, type State } from './stack/rules'
import './stack/stack.css'

const ROWS = 9

export function StackTower({ onFinish, seed }: GameProps) {
  const { game, phase, dispatch, best, paused, setPaused, restart } = useRun<State>({
    seed,
    onFinish,
    create: newGame,
    step,
    phase: (s) => s.status,
    result: (s) => ({ score: score(s), won: false, stats: { floors: floors(s), perfects: s.perfects } }),
  })

  useKeys((k) => {
    if (k !== ' ' && k !== 'enter' && k !== 'arrowdown') return false
    if (phase === 'over') return false
    dispatch(drop)
    return true
  })

  const { stack, cur, status } = game
  const shift = Math.max(0, stack.length - (ROWS - 2))
  const row = (i: number): React.CSSProperties => ({ bottom: `${((i - shift) * 100) / ROWS}%`, height: `${100 / ROWS}%` })
  return (
    <div className="stk">
      <div className="stk-stats">
        <span>Score <b>{score(game)}</b></span>
        <span>Floors <b>{floors(game)}</b></span>
        <span>Speed <b>{Math.round(speedAt(floors(game)))}</b></span>
        {best > 0 && <span>Best <b>{best}</b></span>}
        <PauseButton phase={phase} paused={paused} onPause={() => setPaused(true)} />
      </div>
      <div className="stk-field" data-status={status} data-floors={floors(game)} onPointerDown={(e) => { if (!(e.target as HTMLElement).closest('button') && status !== 'over') dispatch(drop) }}>
        {stack.map((b, i) => <span key={i} className="stk-block" style={{ ...row(i), left: `${b.x}%`, width: `${b.w}%`, '--hue': `${(200 + i * 14) % 360}` } as React.CSSProperties} />)}
        {status !== 'over' && <span className="stk-block stk-cur" data-x={cur.x.toFixed(1)} style={{ ...row(stack.length), left: `${cur.x}%`, width: `${cur.w}%`, '--hue': `${(200 + stack.length * 14) % 360}`, transition: 'none' } as React.CSSProperties} />}
        {game.last === 'perfect' && status === 'playing' && <span key={stack.length} className="stk-flash">Perfect!</span>}
        <RunOverlay
          className="stk-over"
          phase={phase}
          paused={paused}
          onResume={() => setPaused(false)}
          ready={{ title: 'Stack Tower', text: 'Tap, or press space, to drop each block. Line it up: any overhang is cut off.', action: 'Start', onAction: () => dispatch(drop) }}
          over={{ title: 'Tower fell!', text: `Score ${score(game)} · ${floors(game)} floors · ${game.perfects} perfect`, action: 'Play again', onAction: restart }}
        />
      </div>
      <button type="button" className="stk-drop" aria-label="Drop block" disabled={status === 'over'} onPointerDown={(e) => { e.stopPropagation(); dispatch(drop) }} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') e.stopPropagation() }}>Drop</button>
    </div>
  )
}
