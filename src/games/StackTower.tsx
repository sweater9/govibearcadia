import { useCallback, useEffect, useRef, useState } from 'react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { drop, floors, newGame, score, speedAt, step, type State } from './stack/rules'
import './stack/stack.css'

const ROWS = 9

export function StackTower({ onFinish, seed }: GameProps) {
  const [base] = useState(() => seed ?? String(createRandom()()))
  const [run, setRun] = useState(0)
  const [game, setGameState] = useState<State>(() => newGame(base))
  const [best, setBest] = useState(0)
  const current = useRef(game)
  const startedAt = useRef(0)
  const reported = useRef(false)
  const finish = useRef(onFinish)
  finish.current = onFinish

  /** Every change comes through here, from event handlers or the animation callback, never from a state updater. */
  const apply = useCallback((next: State) => {
    const before = current.current
    if (next === before) return
    current.current = next
    setGameState(next)
    if (before.status === 'ready' && next.status === 'playing') startedAt.current = Date.now()
    if (next.status === 'over' && !reported.current) {
      reported.current = true
      const points = score(next)
      setBest((b) => Math.max(b, points))
      finish.current({ score: points, durationMs: Math.max(0, Date.now() - startedAt.current), won: false, stats: { floors: floors(next), perfects: next.perfects } })
    }
  }, [])

  const restart = () => {
    reported.current = false
    const fresh = newGame(`${base}-${run + 1}`)
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
      if (current.current.status === 'playing') apply(step(current.current, dt))
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [apply])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') {
        if (current.current.status === 'over') return
        apply(drop(current.current))
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [apply])

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
      </div>
      <div className="stk-field" data-status={status} data-floors={floors(game)} onPointerDown={(e) => { if (!(e.target as HTMLElement).closest('button') && status !== 'over') apply(drop(current.current)) }}>
        {stack.map((b, i) => <span key={i} className="stk-block" style={{ ...row(i), left: `${b.x}%`, width: `${b.w}%`, '--hue': `${(200 + i * 14) % 360}` } as React.CSSProperties} />)}
        {status !== 'over' && <span className="stk-block stk-cur" data-x={cur.x.toFixed(1)} style={{ ...row(stack.length), left: `${cur.x}%`, width: `${cur.w}%`, '--hue': `${(200 + stack.length * 14) % 360}`, transition: 'none' } as React.CSSProperties} />}
        {game.last === 'perfect' && status === 'playing' && <span key={stack.length} className="stk-flash">Perfect!</span>}
        {status !== 'playing' && (
          <div className="stk-over" role="status">
            {status === 'ready' ? (
              <>
                <strong>Stack Tower</strong>
                <span>Tap, or press space, to drop each block. Line it up: any overhang is cut off.</span>
                <button type="button" className="primary-btn" onClick={() => apply(drop(current.current))}>Start</button>
              </>
            ) : (
              <>
                <strong>Tower fell!</strong>
                <span>Score {score(game)} · {floors(game)} floors · {game.perfects} perfect</span>
                <button type="button" className="primary-btn" onClick={restart}>Play again</button>
              </>
            )}
          </div>
        )}
      </div>
      <button type="button" className="stk-drop" aria-label="Drop block" disabled={status === 'over'} onPointerDown={(e) => { e.stopPropagation(); apply(drop(current.current)) }} onKeyDown={(e) => e.stopPropagation()}>Drop</button>
    </div>
  )
}
