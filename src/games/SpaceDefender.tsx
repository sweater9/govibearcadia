import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import {
  BULLET_H, BULLET_W, ENEMY_H, ENEMY_W, H, SHIP_H, SHIP_W, SHIP_Y, SHOT_W, W, WAVES,
  aliveCount, enemyPos, moveShip, newGame, start, step, type DefenderState,
} from './defender/rules'

/** Physics runs at a fixed rate, whatever the frame rate. */
const FIXED_MS = 1000 / 120
const MAX_FRAME_MS = 100
const pct = (v: number, of: number) => `${(v / of) * 100}%`

export function SpaceDefender({ onFinish, seed }: GameProps) {
  const random = useMemo(() => createRandom(seed), [seed])
  const [game, setGameState] = useState<DefenderState>(() => newGame())
  const [paused, setPaused] = useState(false)
  // Input and the loop read the newest state from a ref that is updated synchronously.
  const current = useRef(game)
  const dir = useRef<-1 | 0 | 1>(0)
  const playedMs = useRef(0)
  const reported = useRef(false)
  const field = useRef<HTMLDivElement>(null)
  const over = game.status === 'won' || game.status === 'lost'

  const setGame = useCallback((next: DefenderState) => {
    current.current = next
    setGameState(next)
  }, [])

  const report = useCallback(
    (state: DefenderState) => {
      if (reported.current) return
      reported.current = true
      onFinish({
        score: state.score,
        durationMs: playedMs.current,
        won: state.status === 'won',
        stats: { wave: state.wave, lives: state.lives },
      })
    },
    [onFinish],
  )

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
        s = step(s, FIXED_MS / 1000, dir.current, random)
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
  }, [running, random, report, setGame])

  const begin = useCallback(() => {
    if (current.current.status === 'ready' && !paused) setGame(start(current.current))
  }, [paused, setGame])

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
    const onDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        dir.current = -1
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        dir.current = 1
      } else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter') {
        if ((e.target as HTMLElement | null)?.closest?.('button')) return
        e.preventDefault()
        if (current.current.status === 'ready') begin()
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
  }, [begin, togglePause])

  const pointerTo = (e: PointerEvent) => {
    const rect = field.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || paused || !Number.isFinite(e.clientX)) return
    setGame(moveShip(current.current, ((e.clientX - rect.left) / rect.width) * W))
  }

  const restart = () => {
    // A run abandoned with points still counts once, like the other games.
    if (current.current.score > 0) report(current.current)
    reported.current = false
    playedMs.current = 0
    dir.current = 0
    setPaused(false)
    setGame(newGame())
  }

  const alive = aliveCount(game)
  const blink = game.invuln > 0 && Math.floor(game.invuln * 10) % 2 === 0

  return (
    <div className="sd">
      <div className="game-toolbar sd-bar">
        <div>
          <small>Score</small>
          <strong>{game.score}</strong>
        </div>
        <div>
          <small>Wave</small>
          <strong aria-label={`Wave ${game.wave} of ${WAVES}`}>
            {game.wave}/{WAVES}
          </strong>
        </div>
        <div>
          <small>Lives</small>
          <strong aria-label={`${game.lives} lives`}>{'♥'.repeat(game.lives) || '–'}</strong>
        </div>
        <button onClick={togglePause} disabled={game.status !== 'playing'} aria-label={paused ? 'Resume' : 'Pause'}>
          {paused ? <Play size={15} /> : <Pause size={15} />}
        </button>
        <button onClick={restart} aria-label="New game">
          <RotateCcw size={15} />
        </button>
      </div>
      <div
        ref={field}
        className="sd-field"
        role="group"
        aria-label={`Space Defender field, ${alive} invaders left`}
        data-status={paused && game.status === 'playing' ? 'paused' : game.status}
        onPointerMove={pointerTo}
        onPointerDown={(e) => {
          pointerTo(e)
          begin()
        }}
      >
        {game.enemies.map((up, i) => {
          if (!up) return null
          const p = enemyPos(game, i)
          return (
            <div
              key={i}
              className="sd-enemy"
              data-r={Math.floor(i / 6)}
              data-i={i}
              style={{ left: pct(p.x, W), top: pct(p.y, H), width: pct(ENEMY_W, W), height: pct(ENEMY_H, H) }}
            />
          )
        })}
        {game.bullets.map((b, i) => (
          <div key={`b${i}`} className="sd-bullet" style={{ left: pct(b.x, W), top: pct(b.y, H), width: pct(BULLET_W, W), height: pct(BULLET_H, H) }} />
        ))}
        {game.shots.map((b, i) => (
          <div key={`s${i}`} className="sd-shot" style={{ left: pct(b.x, W), top: pct(b.y, H), width: pct(SHOT_W, W), height: pct(BULLET_H, H) }} />
        ))}
        <div
          className="sd-ship"
          data-x={Math.round(game.shipX)}
          data-blink={blink || undefined}
          style={{ left: pct(game.shipX - SHIP_W / 2, W), top: pct(SHIP_Y, H), width: pct(SHIP_W, W), height: pct(SHIP_H, H) }}
        />
        {game.status === 'ready' ? <div className="sd-hint">Move to aim, then tap, click or press Space. Your ship fires on its own.</div> : null}
        {paused && game.status === 'playing' ? <div className="sd-hint">Paused</div> : null}
      </div>
      <p className="game-help">Mouse or finger moves the ship; ←/→ or A/D too. Clear {WAVES} waves to win.</p>
      {over ? (
        <div className="game-over">
          <h3>{game.status === 'won' ? 'Planet defended!' : 'Overrun'}</h3>
          <p>
            Wave {game.wave} · score {game.score}
          </p>
          <button className="primary-btn" onClick={restart}>
            Play again
          </button>
        </div>
      ) : null}
    </div>
  )
}
