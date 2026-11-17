import { useCallback, useEffect, useRef, useState } from 'react'
import { createRandom } from '../lib/rng'
import { levelPace } from '../lib/levels'
import type { GameProps } from '../types'
import { COLS, IDLE_LIMIT, carsAt, hop, newGame, rowAt, score, start, step, type Dir, type State } from './hopper/rules'
import './hopper/hopper.css'

const ROWS = 9
const KEYS: Record<string, Dir> = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' }
const TINTS = ['#ff7a59', '#ffd166', '#9b8cff', '#5eead4', '#f472b6']

export function LaneHopper({ onFinish, seed, level = 1 }: GameProps) {
  const pace = levelPace(level)
  const [base] = useState(() => seed ?? String(createRandom()()))
  const [run, setRun] = useState(0)
  const [game, setGameState] = useState<State>(() => newGame(base))
  const current = useRef(game)
  const startedAt = useRef(0)
  const reported = useRef(false)
  const finish = useRef(onFinish)
  finish.current = onFinish
  const [best, setBest] = useState(0)

  /** Every transition comes through here, from event handlers or the animation callback, never from a state updater. */
  const apply = useCallback((next: State) => {
    const before = current.current
    if (next === before) return
    current.current = next
    setGameState(next)
    if (before.status === 'ready' && next.status === 'playing') startedAt.current = Date.now()
    if (next.status === 'dead' && !reported.current) {
      reported.current = true
      const points = score(next)
      setBest((b) => Math.max(b, points))
      finish.current({ score: points, durationMs: Math.max(0, Date.now() - startedAt.current), won: false, stats: { rows: next.best, eagle: next.cause === 'eagle' ? 1 : 0 } })
    }
  }, [])

  const restart = () => {
    reported.current = false
    const fresh = newGame(run === 0 ? `${base}-1` : `${base}-${run + 1}`)
    current.current = fresh
    setGameState(fresh)
    setRun(run + 1)
  }

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(50, now - last)
      last = now
      if (current.current.status === 'playing') apply(step(current.current, dt * pace))
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [apply, pace])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = KEYS[e.key.toLowerCase()]
      if (dir) apply(hop(current.current, dir))
      else if ((e.key === ' ' || e.key === 'Enter') && current.current.status === 'ready') apply(start(current.current))
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [apply])

  const { status, row, col, t } = game
  const cam = Math.max(0, game.best - 2)
  const visible = Array.from({ length: ROWS }, (_, i) => cam + i)
  const pct = (n: number) => `${(n * 100) / COLS}%`
  const eagle = Math.max(0, Math.min(1, game.idle / IDLE_LIMIT))
  const pad = (dir: Dir, label: string, glyph: string) => (
    <button type="button" aria-label={label} className={`hp-${dir}`} onPointerDown={(e) => { e.stopPropagation(); apply(hop(current.current, dir)) }} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') e.stopPropagation() }}>{glyph}</button>
  )

  return (
    <div className="hp">
      <div className="hp-stats">
        <span>Rows <b>{score(game)}</b></span>
        {best > 0 && <span>Best <b>{best}</b></span>}
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
        {status !== 'playing' && (
          <div className="hp-over" role="status">
            {status === 'ready' ? (
              <>
                <strong>Lane Hopper</strong>
                <span>Hop forward across the roads. Arrow keys or the pad. Do not linger: the eagle is watching.</span>
                <button type="button" className="primary-btn" onClick={() => apply(start(current.current))}>Start</button>
              </>
            ) : (
              <>
                <strong>{game.cause === 'eagle' ? 'Caught by the eagle!' : 'Squashed!'}</strong>
                <span>{score(game)} rows crossed</span>
                <button type="button" className="primary-btn" onClick={restart}>Play again</button>
              </>
            )}
          </div>
        )}
      </div>
      <div className="hp-pad">
        {pad('left', 'Hop left', '◀')}{pad('up', 'Hop forward', '▲')}{pad('down', 'Hop back', '▼')}{pad('right', 'Hop right', '▶')}
      </div>
    </div>
  )
}
