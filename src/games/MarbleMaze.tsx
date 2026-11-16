import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { CELL, FALL_PENALTY, HOLE_DRAW, LEVELS, MARBLE_R, NO_TILT, WALL, centre, elapsed, newGame, scoreFor, start, step, type Level, type MState, type Tilt } from './marble/rules'
import './marble/marble.css'

/** Physics runs at a fixed rate, whatever the frame rate. */
const FIXED_MS = 1000 / 120
const MAX_FRAME_MS = 100
/** A drag this many pixels from where it began tilts the board fully. */
const DRAG_FULL_PX = 56

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}.${Math.floor((sec % 1) * 10)}`

export function MarbleMaze({ onFinish, seed }: GameProps) {
  const base = useMemo(() => seed ?? String(Math.floor(createRandom()() * 1e9)), [seed])
  const [level, setLevel] = useState<Level>('normal')
  const [run, setRun] = useState(0)
  const [game, setGameState] = useState<MState>(() => newGame('normal', `${base}:0`))
  const [paused, setPaused] = useState(false)
  const current = useRef(game)
  const keys = useRef({ up: false, down: false, left: false, right: false })
  const drag = useRef<Tilt | null>(null)
  const dragOrigin = useRef<{ x: number; y: number } | null>(null)
  const device = useRef<Tilt | null>(null)
  const playedMs = useRef(0)
  const reported = useRef(false)
  const [tiltOn, setTiltOn] = useState(false)
  const won = game.status === 'won'

  const setGame = useCallback((next: MState) => {
    current.current = next
    setGameState(next)
  }, [])

  const report = useCallback(
    (s: MState) => {
      if (reported.current) return
      reported.current = true
      onFinish({ score: scoreFor(s), durationMs: playedMs.current, won: true, stats: { level: Object.keys(LEVELS).indexOf(s.level), time: Math.round(elapsed(s) * 10) / 10, falls: s.falls, par: s.par } })
    },
    [onFinish],
  )

  const tilt = useCallback((): Tilt => {
    if (drag.current) return drag.current
    const k = keys.current
    const kx = (k.right ? 1 : 0) - (k.left ? 1 : 0)
    const ky = (k.down ? 1 : 0) - (k.up ? 1 : 0)
    if (kx || ky) return { x: kx, y: ky }
    return device.current ?? NO_TILT
  }, [])

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
      const input = tilt()
      while (acc >= FIXED_MS && s.status === 'playing') {
        s = step(s, FIXED_MS / 1000, input)
        playedMs.current += FIXED_MS
        acc -= FIXED_MS
      }
      if (s !== current.current) {
        setGame(s)
        if (s.status === 'won') report(s)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [running, report, setGame, tilt])

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
    const which = (k: string): keyof typeof keys.current | null =>
      k === 'ArrowUp' || k === 'w' || k === 'W' ? 'up' : k === 'ArrowDown' || k === 's' || k === 'S' ? 'down' : k === 'ArrowLeft' || k === 'a' || k === 'A' ? 'left' : k === 'ArrowRight' || k === 'd' || k === 'D' ? 'right' : null
    const onDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const w = which(e.key)
      if (w) {
        keys.current[w] = true
        begin()
      } else if (e.key === ' ' || e.key === 'Enter') {
        if ((e.target as HTMLElement | null)?.closest?.('button,select')) return
        begin()
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        togglePause()
        return
      } else return
      e.preventDefault()
    }
    const onUp = (e: KeyboardEvent) => {
      const w = which(e.key)
      if (w) keys.current[w] = false
    }
    const onBlur = () => (keys.current = { up: false, down: false, left: false, right: false })
    addEventListener('keydown', onDown)
    addEventListener('keyup', onUp)
    addEventListener('blur', onBlur)
    return () => {
      removeEventListener('keydown', onDown)
      removeEventListener('keyup', onUp)
      removeEventListener('blur', onBlur)
    }
  }, [begin, togglePause])

  // Optional: tilt the phone. Needs a tap, because some browsers ask permission first.
  useEffect(() => {
    if (!tiltOn) return
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return
      const clamp = (v: number) => Math.max(-1, Math.min(1, v))
      device.current = { x: clamp(e.gamma / 20), y: clamp((e.beta - 35) / 20) }
    }
    addEventListener('deviceorientation', onOrient)
    return () => {
      removeEventListener('deviceorientation', onOrient)
      device.current = null
    }
  }, [tiltOn])
  const canTilt = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window
  const enableTilt = async () => {
    if (tiltOn) return setTiltOn(false)
    const D = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
    try {
      if (typeof D.requestPermission === 'function' && (await D.requestPermission()) !== 'granted') return
      setTiltOn(true)
    } catch {
      /* permission refused: keyboard and drag still work */
    }
  }

  const restart = (l: Level = level) => {
    reported.current = false
    playedMs.current = 0
    keys.current = { up: false, down: false, left: false, right: false }
    drag.current = null
    setPaused(false)
    setLevel(l)
    setRun((r) => r + 1)
    setGame(newGame(l, `${base}:${run + 1}`))
  }

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('select,label')) return
    begin()
    dragOrigin.current = { x: e.clientX, y: e.clientY }
    drag.current = NO_TILT
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const o = dragOrigin.current
    if (!o) return
    const cl = (v: number) => Math.max(-1, Math.min(1, v / DRAG_FULL_PX))
    drag.current = { x: cl(e.clientX - o.x), y: cl(e.clientY - o.y) }
  }
  const endDrag = () => {
    dragOrigin.current = null
    drag.current = null
  }

  const walls = useMemo(() => {
    let d = ''
    for (let r = 0; r <= game.rows; r++)
      for (let c = 0; c < game.cols; c++) if (game.h[r * game.cols + c]) d += `M${c * CELL} ${r * CELL}h${CELL}`
    for (let r = 0; r < game.rows; r++)
      for (let c = 0; c <= game.cols; c++) if (game.v[r * (game.cols + 1) + c]) d += `M${c * CELL} ${r * CELL}v${CELL}`
    return d
  }, [game.h, game.v, game.cols, game.rows])

  const W = game.cols * CELL
  const H = game.rows * CELL
  const goal = centre(game.goal)
  const time = elapsed(game)
  return (
    <div className="mz">
      <div className="game-toolbar mz-bar">
        <div><small>Time</small><strong>{fmt(time)}</strong></div>
        <div><small>Falls</small><strong>{game.falls}</strong></div>
        <div><small>Par</small><strong>{fmt(game.par)}</strong></div>
        <button onClick={togglePause} disabled={game.status !== 'playing'} aria-label={paused ? 'Resume' : 'Pause'}>{paused ? <Play size={15} /> : <Pause size={15} />}</button>
        <button onClick={() => restart()} aria-label="New game"><RotateCcw size={15} /></button>
      </div>
      <div
        className="mz-board"
        role="group"
        aria-label={`Marble maze, ${LEVELS[game.level].label}, ${game.falls} falls`}
        data-status={paused && game.status === 'playing' ? 'paused' : game.status}
        data-x={Math.round(game.x * 10) / 10}
        data-y={Math.round(game.y * 10) / 10}
        data-falls={game.falls}
        data-cp={game.cp}
        data-level={game.level}
        style={{ aspectRatio: `${W} / ${H}` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <svg viewBox={`${-WALL} ${-WALL} ${W + 2 * WALL} ${H + 2 * WALL}`} aria-hidden="true">
          <rect className="mz-floor" x={0} y={0} width={W} height={H} />
          {game.checkpoints.map((c, i) => {
            const p = centre(c)
            return <circle key={`c${i}`} className="mz-check" data-reached={game.cp >= i || undefined} cx={p.x} cy={p.y} r={2.6} />
          })}
          {game.holes.map((h, i) => {
            const p = centre(h)
            return <circle key={`h${i}`} className="mz-hole" cx={p.x} cy={p.y} r={HOLE_DRAW} />
          })}
          <circle className="mz-goal" cx={goal.x} cy={goal.y} r={3} />
          <path className="mz-walls" d={walls} strokeWidth={WALL} />
          <circle className="mz-marble" cx={game.x} cy={game.y} r={MARBLE_R} />
        </svg>
        {game.status === 'ready' ? (
          <div className="mz-hint">
            <label>Difficulty<select aria-label="Difficulty" value={level} onChange={(e) => restart(e.target.value as Level)} onPointerDown={(e) => e.stopPropagation()}>{(Object.keys(LEVELS) as Level[]).map((l) => <option key={l} value={l}>{LEVELS[l].label}</option>)}</select></label>
            <span>Tilt with the arrow keys or drag on the board. Press a key or drag to start.</span>
            {canTilt ? <button type="button" className="mz-tilt" onClick={enableTilt} onPointerDown={(e) => e.stopPropagation()}>{tiltOn ? 'Phone tilt: on' : 'Use phone tilt'}</button> : null}
          </div>
        ) : null}
        {paused && game.status === 'playing' ? <div className="mz-hint">Paused</div> : null}
      </div>
      <p className="game-help">Roll the marble to the green goal. Holes send you back to the last checkpoint (+{FALL_PENALTY}s). Tilt with the arrow keys, WASD or by dragging. P or Escape pauses.</p>
      {won ? (
        <div className="game-over">
          <h3>Through the maze</h3>
          <p>{fmt(time)} · {game.falls} {game.falls === 1 ? 'fall' : 'falls'} · score {scoreFor(game)}</p>
          <button className="primary-btn" onClick={() => restart()}>Play again</button>
        </div>
      ) : null}
    </div>
  )
}
