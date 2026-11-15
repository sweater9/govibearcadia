import type { GameProps } from '../types'
import { COLS, IDLE_LIMIT, carsAt, hop, newGame, rowAt, score, start, step, type Dir, type State } from './hopper/rules'
import { PauseButton, RunOverlay } from './shared/RunOverlay'
import { useKeys, useRun } from './shared/useRun'
import './hopper/hopper.css'

const ROWS = 9
const KEYS: Record<string, Dir> = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' }
const TINTS = ['#ff7a59', '#ffd166', '#9b8cff', '#5eead4', '#f472b6']
/** A focused pad button must not also start the game with Space or Enter; every other key (arrows, P) still reaches the game. */
const stopSpaceAndEnter = (e: React.KeyboardEvent) => {
  if (e.key === ' ' || e.key === 'Enter') e.stopPropagation()
}

export function LaneHopper({ onFinish, seed }: GameProps) {
  const { game, phase, dispatch, best, paused, setPaused, restart } = useRun<State>({
    seed,
    onFinish,
    create: newGame,
    step,
    phase: (s) => (s.status === 'dead' ? 'over' : s.status),
    result: (s) => ({ score: score(s), won: false, stats: { rows: s.best, eagle: s.cause === 'eagle' ? 1 : 0 } }),
  })

  useKeys((k) => {
    const dir = KEYS[k]
    if (dir) dispatch((s) => hop(s, dir))
    else if ((k === ' ' || k === 'enter') && phase === 'ready') dispatch(start)
    else return false
    return true
  })

  const { status, row, col, t } = game
  const cam = Math.max(0, game.best - 2)
  const visible = Array.from({ length: ROWS }, (_, i) => cam + i)
  const pct = (n: number) => `${(n * 100) / COLS}%`
  const eagle = Math.max(0, Math.min(1, game.idle / IDLE_LIMIT))
  const pad = (dir: Dir, label: string, glyph: string) => (
    <button type="button" aria-label={label} className={`hp-${dir}`} onPointerDown={(e) => { e.stopPropagation(); dispatch((s) => hop(s, dir)) }} onKeyDown={stopSpaceAndEnter}>{glyph}</button>
  )

  return (
    <div className="hp">
      <div className="hp-stats">
        <span>Rows <b>{score(game)}</b></span>
        {best > 0 && <span>Best <b>{best}</b></span>}
        <PauseButton phase={phase} paused={paused} onPause={() => setPaused(true)} />
        <span className="hp-eagle" aria-hidden="true"><i style={{ width: `${eagle * 100}%` }} data-warn={eagle > 0.6} /></span>
      </div>
      <div className="hp-field" data-status={status} data-row={row} data-col={col} style={{ '--cols': COLS, '--rows': ROWS } as React.CSSProperties}>
        {visible.map((r) => {
          const def = rowAt(game.seed, r)
          return (
            <div key={r} className={`hp-row hp-${def.kind}`} style={{ bottom: `${((r - cam) * 100) / ROWS}%` }}>
              {def.trees.map((c) => <span key={c} className="hp-tree" style={{ left: pct(c) }} />)}
              {carsAt(def, t).map((c, i) => {
                // Cars slide in and out of the edges: draw only the part inside the board.
                const left = Math.max(0, c.x)
                const right = Math.min(COLS, c.x + c.length)
                if (right <= left) return null
                return <span key={i} className="hp-car" style={{ left: pct(left), width: pct(right - left), '--tint': TINTS[(r + i + 5) % TINTS.length], '--flip': def.dir } as React.CSSProperties} />
              })}
            </div>
          )
        })}
        <span className="hp-me" role="img" aria-label={`Frog, row ${row}, column ${col + 1}`} style={{ left: pct(col), bottom: `${((row - cam) * 100) / ROWS}%` }} />
        <RunOverlay
          className="hp-over"
          phase={phase}
          paused={paused}
          onResume={() => setPaused(false)}
          ready={{ title: 'Lane Hopper', text: 'Hop forward across the roads. Arrow keys or the pad. Do not linger: the eagle is watching.', action: 'Start', onAction: () => dispatch(start) }}
          over={{ title: game.cause === 'eagle' ? 'Caught by the eagle!' : 'Squashed!', text: `${score(game)} rows crossed`, action: 'Play again', onAction: restart }}
        />
      </div>
      <div className="hp-pad">
        {pad('left', 'Hop left', '◀')}{pad('up', 'Hop forward', '▲')}{pad('down', 'Hop back', '▼')}{pad('right', 'Hop right', '▶')}
      </div>
    </div>
  )
}
