import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import {
  BALL_R, BRICK_H, BRICK_W, COLS, H, PADDLE_H, PADDLE_W, PADDLE_Y, TOP, W,
  launch, movePaddle, newGame, step, type BreakerState,
} from './breaker/rules'

/** Physics runs at a fixed rate, whatever the frame rate, so a game plays the same on every screen. */
const FIXED_MS = 1000 / 120
const MAX_FRAME_MS = 100
const pct = (v: number, of: number) => `${(v / of) * 100}%`

export function BrickBreaker({ onFinish, seed }: GameProps) {
  const random = useMemo(() => createRandom(seed), [seed])
  const [game, setGameState] = useState<BreakerState>(() => newGame())
  const [paused, setPaused] = useState(false)
  // Input and the loop read the newest state from a ref that is updated synchronously.
  const current = useRef(game)
  const dir = useRef<-1 | 0 | 1>(0)
  const playedMs = useRef(0)
  const reported = useRef(false)
  const field = useRef<HTMLDivElement>(null)
  const over = game.status === 'lost' || game.status === 'won'

  const setGame = useCallback((next: BreakerState) => {
    current.current = next
    setGameState(next)
  }, [])

  const report = useCallback(
    (state: BreakerState) => {
      if (reported.current) return
      reported.current = true
      onFinish({
        score: state.score,
        durationMs: playedMs.current,
        won: state.status === 'won',
        stats: { bricks: state.broken, lives: state.lives },
      })
    },
    [onFinish],
  )

  // Frame loop: runs while waiting to serve or playing, and not paused. Whole fixed steps only.
  const running = (game.status === 'ready' || game.status === 'playing') && !paused
  useEffect(() => {
    if (!running) return
    let raf = 0
    let last = -1
    let acc = 0
    const frame = (t: number) => {
      if (last >= 0) acc += Math.min(t - last, MAX_FRAME_MS)
      last = t
      let s = current.current
      while (acc >= FIXED_MS && (s.status === 'ready' || s.status === 'playing')) {
        s = step(s, FIXED_MS / 1000, dir.current)
        if (s.status === 'playing') playedMs.current += FIXED_MS
        acc -= FIXED_MS
      }
      if (s !== current.current) {
        setGame(s)
        if (s.status === 'won' || s.status === 'lost') report(s)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [running, report, setGame])

  const serve = useCallback(() => {
    if (current.current.status === 'ready' && !paused) setGame(launch(current.current, random))
  }, [paused, random, setGame])

  const togglePause = useCallback(() => {
    if (current.current.status === 'playing') setPaused((p) => !p)
  }, [])

  // Switching tabs pauses a running game.
  useEffect(() => {
    const onHide = () => {
      if (document.hidden && current.current.status === 'playing') setPaused(true)
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        dir.current = -1
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        dir.current = 1
      } else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter') {
        if ((e.target as HTMLElement | null)?.closest?.('button')) return // a focused button handles itself
        e.preventDefault()
        if (current.current.status === 'ready') serve()
        else if (e.key === ' ') togglePause()
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') togglePause()
    }
    const onUp = (e: KeyboardEvent) => {
      if ((e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') && dir.current === -1) dir.current = 0
      if ((e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') && dir.current === 1) dir.current = 0
    }
    const onBlur = () => (dir.current = 0)
    addEventListener('keydown', onDown)
    addEventListener('keyup', onUp)
    addEventListener('blur', onBlur)
    return () => {
      removeEventListener('keydown', onDown)
      removeEventListener('keyup', onUp)
      removeEventListener('blur', onBlur)
    }
  }, [serve, togglePause])

  const pointerTo = (e: PointerEvent) => {
    const rect = field.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || paused || !Number.isFinite(e.clientX)) return
    setGame(movePaddle(current.current, ((e.clientX - rect.left) / rect.width) * W))
  }

  const restart = () => {
    // Like Neon Merge and Snake: a run abandoned with a score still counts once.
    if (current.current.score > 0) report(current.current)
    reported.current = false
    playedMs.current = 0
    dir.current = 0
    setPaused(false)
    setGame(newGame())
  }

  const alive = game.bricks.reduce((n, b) => n + (b ? 1 : 0), 0)

  return (
    <div className="brk">
      <div className="game-toolbar brk-bar">
        <div>
          <small>Score</small>
          <strong>{game.score}</strong>
        </div>
        <div>
          <small>Lives</small>
          <strong aria-label={`${game.lives} lives`}>{'♥'.repeat(game.lives) || '–'}</strong>
        </div>
        <button onClick={togglePause} disabled={game.status !== 'playing'}>
          {paused ? <Play size={15} /> : <Pause size={15} />}
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button onClick={restart}>
          <RotateCcw size={15} />
          New
        </button>
      </div>
      <div
        ref={field}
        className="brk-field"
        role="group"
        aria-label={`Brick Breaker field, ${alive} bricks left`}
        data-status={paused && game.status === 'playing' ? 'paused' : game.status}
        onPointerMove={pointerTo}
        onPointerDown={(e) => {
          pointerTo(e)
          serve()
        }}
      >
        {game.bricks.map((up, i) =>
          up ? (
            <div
              key={i}
              className="brk-brick"
              data-r={Math.floor(i / COLS)}
              data-c={i % COLS}
              style={{ left: pct((i % COLS) * BRICK_W, W), top: pct(TOP + Math.floor(i / COLS) * BRICK_H, H), width: pct(BRICK_W, W), height: pct(BRICK_H, H) }}
            />
          ) : null,
        )}
        <div
          className="brk-paddle"
          data-x={Math.round(game.paddleX)}
          style={{ left: pct(game.paddleX - PADDLE_W / 2, W), top: pct(PADDLE_Y, H), width: pct(PADDLE_W, W), height: pct(PADDLE_H, H) }}
        />
        <div
          className="brk-ball"
          data-x={Math.round(game.ball.x)}
          data-y={Math.round(game.ball.y)}
          style={{ left: pct(game.ball.x - BALL_R, W), top: pct(game.ball.y - BALL_R, H), width: pct(BALL_R * 2, W), height: pct(BALL_R * 2, H) }}
        />
        {game.status === 'ready' ? <div className="brk-hint">Move to aim, then tap, click or press Space to serve</div> : null}
        {paused && game.status === 'playing' ? <div className="brk-hint">Paused</div> : null}
      </div>
      <p className="game-help">Mouse or finger moves the paddle; ←/→ or A/D too. Space serves and pauses.</p>
      {over ? (
        <div className="game-over">
          <h3>{game.status === 'won' ? 'Wall cleared!' : 'Game over'}</h3>
          <p>Final score: {game.score}</p>
          <button className="primary-btn" onClick={restart}>
            Play again
          </button>
        </div>
      ) : null}
    </div>
  )
}
