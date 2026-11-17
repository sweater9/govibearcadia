import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { createRandom } from '../lib/rng'
import { levelPace } from '../lib/levels'
import type { GameProps } from '../types'
import { LEVELS, NO_INPUT, RADIUS, SHIP_R, SIZE, newGame, start, step, type AState, type Input, type Level } from './asteroid/rules'
import './asteroid/asteroid.css'

/** Physics runs at a fixed rate, whatever the frame rate. */
const FIXED_MS = 1000 / 120
const MAX_FRAME_MS = 100

export function AsteroidAssault({ onFinish, seed, level: stage = 1 }: GameProps) {
  const pace = levelPace(stage)
  const [level, setLevel] = useState<Level>('normal')
  const [run, setRun] = useState(0)
  const random = useMemo(() => createRandom(`${seed ?? 'asteroid'}:${run}`), [seed, run])
  const [game, setGameState] = useState<AState>(() => newGame('normal'))
  const [paused, setPaused] = useState(false)
  const current = useRef(game)
  const input = useRef<Input>({ ...NO_INPUT })
  const playedMs = useRef(0)
  const reported = useRef(false)
  const over = game.status === 'lost'

  const setGame = useCallback((next: AState) => {
    current.current = next
    setGameState(next)
  }, [])

  const report = useCallback(
    (s: AState) => {
      if (reported.current) return
      reported.current = true
      onFinish({ score: s.score, durationMs: playedMs.current, won: false, stats: { wave: s.wave, hits: s.hits, shots: s.shots, accuracy: s.shots ? Math.round((100 * s.hits) / s.shots) : 0 } })
    },
    [onFinish],
  )

  const running = game.status === 'playing' && !paused
  useEffect(() => {
    if (!running) return
    let raf = 0
    let last = -1
    let acc = 0
    const frame = (t: number) => {
      if (last >= 0) acc += Math.min(t - last, MAX_FRAME_MS)
      last = t
      let s = current.current
      while (acc >= FIXED_MS && s.status === 'playing') {
        s = step(s, (FIXED_MS * pace) / 1000, input.current, random)
        playedMs.current += FIXED_MS
        acc -= FIXED_MS
      }
      if (s !== current.current) {
        setGame(s)
        if (s.status === 'lost') report(s)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [running, random, report, setGame, pace])

  const begin = useCallback(() => {
    if (current.current.status === 'ready') setGame(start(current.current))
  }, [setGame])
  const togglePause = useCallback(() => {
    if (current.current.status === 'playing') setPaused((p) => !p)
  }, [])

  useEffect(() => {
    const onHide = () => {
      if (document.hidden && current.current.status === 'playing') setPaused(true)
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  useEffect(() => {
    const left = (k: string) => k === 'ArrowLeft' || k === 'a' || k === 'A'
    const right = (k: string) => k === 'ArrowRight' || k === 'd' || k === 'D'
    const thrust = (k: string) => k === 'ArrowUp' || k === 'w' || k === 'W'
    const onDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key
      if (left(k)) input.current = { ...input.current, turn: -1 }
      else if (right(k)) input.current = { ...input.current, turn: 1 }
      else if (thrust(k)) input.current = { ...input.current, thrust: true }
      else if (k === ' ' || k === 'Enter') {
        if ((e.target as HTMLElement | null)?.closest?.('button')) return
        if (current.current.status === 'ready') begin()
        else input.current = { ...input.current, fire: true }
      } else if (k === 'p' || k === 'P' || k === 'Escape') {
        togglePause()
        return
      } else return
      e.preventDefault()
    }
    const onUp = (e: KeyboardEvent) => {
      const k = e.key
      if ((left(k) && input.current.turn === -1) || (right(k) && input.current.turn === 1)) input.current = { ...input.current, turn: 0 }
      else if (thrust(k)) input.current = { ...input.current, thrust: false }
      else if (k === ' ' || k === 'Enter') input.current = { ...input.current, fire: false }
    }
    const onBlur = () => (input.current = { ...NO_INPUT })
    addEventListener('keydown', onDown)
    addEventListener('keyup', onUp)
    addEventListener('blur', onBlur)
    return () => {
      removeEventListener('keydown', onDown)
      removeEventListener('keyup', onUp)
      removeEventListener('blur', onBlur)
    }
  }, [begin, togglePause])

  const restart = (l: Level = level) => {
    // A run abandoned with points still counts once, like the other games.
    if (current.current.status !== 'ready' && current.current.score > 0) report(current.current)
    reported.current = false
    playedMs.current = 0
    input.current = { ...NO_INPUT }
    setPaused(false)
    setLevel(l)
    setRun((r) => r + 1)
    setGame(newGame(l))
  }

  /** Holding a touch button sets one input until it is released. */
  const hold = (patch: Partial<Input>, off: Partial<Input>) => ({
    onPointerDown: (e: RPointerEvent) => {
      e.preventDefault()
      begin()
      input.current = { ...input.current, ...patch }
    },
    onPointerUp: () => (input.current = { ...input.current, ...off }),
    onPointerLeave: () => (input.current = { ...input.current, ...off }),
    onPointerCancel: () => (input.current = { ...input.current, ...off }),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') e.stopPropagation()
    },
  })

  const blink = game.invuln > 0 && Math.floor(game.invuln * 8) % 2 === 0
  const R = (k: 1 | 2 | 3) => RADIUS[k]

  return (
    <div className="aa">
      <div className="game-toolbar aa-bar">
        <div><small>Score</small><strong>{game.score}</strong></div>
        <div><small>Wave</small><strong>{game.wave}</strong></div>
        <div><small>Lives</small><strong aria-label={`${game.lives} lives`}>{'♥'.repeat(Math.min(game.lives, 8)) || '–'}</strong></div>
        <button onClick={togglePause} disabled={game.status !== 'playing'} aria-label={paused ? 'Resume' : 'Pause'}>{paused ? <Play size={15} /> : <Pause size={15} />}</button>
        <button onClick={() => restart()} aria-label="New game"><RotateCcw size={15} /></button>
      </div>
      <div className="aa-field" role="group" aria-label={`Asteroid field, wave ${game.wave}, ${game.rocks.length} rocks`} data-status={paused && game.status === 'playing' ? 'paused' : game.status} data-rocks={game.rocks.length} data-angle={Math.round(game.angle * 100) / 100} data-x={Math.round(game.x)} data-y={Math.round(game.y)} onPointerDown={begin}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          {game.rocks.map((r, i) => (
            <circle key={i} className="aa-rock" data-size={r.size} cx={r.x} cy={r.y} r={R(r.size)} />
          ))}
          {game.bullets.map((b, i) => <circle key={`b${i}`} className="aa-bullet" cx={b.x} cy={b.y} r={0.9} />)}

            <g className="aa-ship" data-blink={blink || undefined} transform={`translate(${game.x} ${game.y}) rotate(${(game.angle * 180) / Math.PI})`}>
              <path d={`M0 ${-SHIP_R * 1.5} L${SHIP_R} ${SHIP_R} L0 ${SHIP_R * 0.4} L${-SHIP_R} ${SHIP_R} Z`} />
            </g>
        </svg>
        {game.status === 'ready' ? (
          <div className="aa-hint">
            <label>Difficulty<select aria-label="Difficulty" value={level} onChange={(e) => restart(e.target.value as Level)} onPointerDown={(e) => e.stopPropagation()}>{(Object.keys(LEVELS) as Level[]).map((l) => <option key={l} value={l}>{LEVELS[l].label}</option>)}</select></label>
            <span>Turn with ←/→, thrust with ↑, fire with Space. Tap a button or press Space to launch.</span>
          </div>
        ) : null}
        {paused && game.status === 'playing' ? <div className="aa-hint">Paused</div> : null}
      </div>
      <div className="aa-pad" aria-label="Touch controls">
        <button type="button" aria-label="Turn left" {...hold({ turn: -1 }, { turn: 0 })}>↶</button>
        <button type="button" aria-label="Thrust" {...hold({ thrust: true }, { thrust: false })}>▲</button>
        <button type="button" aria-label="Turn right" {...hold({ turn: 1 }, { turn: 0 })}>↷</button>
        <button type="button" aria-label="Fire" className="aa-fire" {...hold({ fire: true }, { fire: false })}>Fire</button>
      </div>
      <p className="game-help">Your ship keeps drifting: thrust, turn and shoot. Rocks split into smaller ones. Everything wraps around the edges. P or Escape pauses.</p>
      {over ? (
        <div className="game-over">
          <h3>Ship lost</h3>
          <p>Wave {game.wave} · score {game.score}</p>
          <button className="primary-btn" onClick={() => restart()}>Play again</button>
        </div>
      ) : null}
    </div>
  )
}
