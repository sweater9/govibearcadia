import { useCallback, useEffect, useRef, useState } from 'react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { BALLS, BUMPERS, H, PIVOTS, R, TARGETS, W, WALLS, flip, flipperSeg, isOver, launch, newGame, score, step, type Level, type Side, type State } from './pinball/rules'
import './pinball/pinball.css'

const LEFT_KEYS = ['arrowleft', 'z', 'a']
const RIGHT_KEYS = ['arrowright', '/', 'l']
const LEVELS: [Level, string][] = [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']]

export function Pinball({ onFinish, seed }: GameProps) {
  const [base] = useState(() => seed ?? String(createRandom()()))
  const [run, setRun] = useState(0)
  const [level, setLevel] = useState<Level>('normal')
  const [game, setGameState] = useState<State>(() => newGame(`${base}-0`, 'normal'))
  const [paused, setPausedState] = useState(false)
  const [best, setBest] = useState(0)
  const current = useRef(game)
  const pausedRef = useRef(false)
  const reported = useRef(false)
  const finish = useRef(onFinish)
  finish.current = onFinish
  const table = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, Side>())

  /** Every transition comes through here, from event handlers or the animation callback, never from a state updater. */
  const apply = useCallback((next: State) => {
    if (next === current.current) return
    current.current = next
    setGameState(next)
    if (isOver(next) && !reported.current) {
      reported.current = true
      const points = score(next)
      setBest((b) => Math.max(b, points))
      finish.current({ score: points, durationMs: Math.round(next.played), won: false, stats: { balls: BALLS, bumps: next.bumps, targets: next.hits, multiplier: next.maxMultiplier } })
    }
  }, [])

  const setPaused = useCallback((p: boolean) => {
    pausedRef.current = p
    setPausedState(p)
  }, [])

  const restart = (l: Level = level) => {
    reported.current = false
    setLevel(l)
    const fresh = newGame(`${base}-${run + 1}`, l)
    current.current = fresh
    setGameState(fresh)
    setRun(run + 1)
    setPaused(false)
  }

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(50, now - last)
      last = now
      if (!pausedRef.current && !isOver(current.current)) apply(step(current.current, dt))
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [apply])

  useEffect(() => {
    const side = (e: KeyboardEvent): Side | null => {
      const k = e.key.toLowerCase()
      if (e.code === 'ShiftLeft' || LEFT_KEYS.includes(k)) return 0
      if (e.code === 'ShiftRight' || RIGHT_KEYS.includes(k)) return 1
      return null
    }
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'p' || k === 'escape') {
        if (!isOver(current.current)) setPaused(!pausedRef.current)
        e.preventDefault()
        return
      }
      if (pausedRef.current) return
      const s = side(e)
      if (s !== null) apply(flip(current.current, s, true))
      else if ((e.key === ' ' || e.key === 'Enter') && current.current.status === 'ready') apply(launch(current.current))
      else return
      e.preventDefault()
    }
    const up = (e: KeyboardEvent) => {
      const s = side(e)
      if (s !== null) apply(flip(current.current, s, false))
    }
    const hide = () => {
      if (document.hidden && !isOver(current.current)) setPaused(true)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    document.addEventListener('visibilitychange', hide)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      document.removeEventListener('visibilitychange', hide)
    }
  }, [apply, setPaused])

  // Touch: the left half of the table works the left flipper, the right half the right one.
  const press = (e: React.PointerEvent) => {
    if (pausedRef.current || (e.target as HTMLElement).closest('button')) return
    const box = table.current!.getBoundingClientRect()
    const s: Side = e.clientX < box.left + box.width / 2 ? 0 : 1
    pointers.current.set(e.pointerId, s)
    apply(flip(current.current, s, true))
  }
  const release = (e: React.PointerEvent) => {
    const s = pointers.current.get(e.pointerId)
    if (s === undefined) return
    pointers.current.delete(e.pointerId)
    if (![...pointers.current.values()].includes(s)) apply(flip(current.current, s, false))
  }

  const { status, ball } = game
  const intro = status === 'ready' && game.launches === 0
  return (
    <div className="pb">
      <div className="pb-stats">
        <span>Score <b>{score(game)}</b></span>
        <span>Ball <b>{Math.min(BALLS, BALLS - game.ballsLeft + (status === 'over' ? 0 : 1))}/{BALLS}</b></span>
        <span>Multiplier <b>x{game.multiplier}</b></span>
        {best > 0 && <span>Best <b>{best}</b></span>}
        {status !== 'over' && <button type="button" onClick={() => setPaused(!paused)}>{paused ? 'Resume' : 'Pause'}</button>}
      </div>
      <div ref={table} className="pb-table" data-status={status} data-paused={paused} data-ball-x={ball.x.toFixed(1)} data-ball-y={ball.y.toFixed(1)} onPointerDown={press} onPointerUp={release} onPointerCancel={release} onPointerLeave={release}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Pinball table. Score ${score(game)}, ball ${BALLS - game.ballsLeft + 1} of ${BALLS}.`}>
          {WALLS.map((w, i) => <line key={i} className="pb-wall" x1={w[0]} y1={w[1]} x2={w[2]} y2={w[3]} />)}
          {BUMPERS.map((b, i) => <circle key={i} className="pb-bumper" cx={b.x} cy={b.y} r={b.r} data-flash={game.flash[i] > 0} />)}
          {TARGETS.map((t, i) => <circle key={i} className="pb-target" cx={t.x} cy={t.y} r={t.r} data-lit={game.lit[i]} />)}
          {([0, 1] as const).map((s) => {
            const f = flipperSeg(game, s)
            return <line key={s} className="pb-flipper" data-side={s === 0 ? 'left' : 'right'} data-held={game.held[s]} x1={f[0]} y1={f[1]} x2={f[2]} y2={f[3]} />
          })}
          <circle className="pb-ball" cx={ball.x} cy={ball.y} r={R} />
          <circle cx={PIVOTS[0].x} cy={PIVOTS[0].y} r="4" fill="#ffc247" />
          <circle cx={PIVOTS[1].x} cy={PIVOTS[1].y} r="4" fill="#ffc247" />
        </svg>
        {status === 'ready' && !paused && (
          <div className="pb-over">
            <strong>{intro ? 'Pinball' : `Ball ${BALLS - game.ballsLeft + 1} of ${BALLS}`}</strong>
            {intro && (
              <>
                <span>Left and right keys (or Shift, or the left and right half of the table) work the flippers. Light all three targets for a higher multiplier.</span>
                <div className="pb-levels" role="group" aria-label="Level">
                  {LEVELS.map(([l, t]) => <button key={l} type="button" aria-pressed={level === l} onClick={() => restart(l)}>{t}</button>)}
                </div>
              </>
            )}
            <button type="button" className="primary-btn" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') e.stopPropagation() }} onClick={() => apply(launch(current.current))}>Launch ball</button>
          </div>
        )}
        {paused && (
          <div className="pb-over">
            <strong>Paused</strong>
            <button type="button" className="primary-btn" onPointerDown={(e) => e.stopPropagation()} onClick={() => setPaused(false)}>Resume</button>
          </div>
        )}
        {status === 'over' && (
          <div className="pb-over">
            <strong>Game over</strong>
            <span>Score {score(game)} · {game.bumps} bumps · best multiplier x{game.maxMultiplier}</span>
            <button type="button" className="primary-btn" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') e.stopPropagation() }} onClick={() => restart()}>Play again</button>
          </div>
        )}
      </div>
    </div>
  )
}
