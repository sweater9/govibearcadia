import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { DIFFICULTY, EH, EW, NO_INPUT, PH, PW, TILE, VIEW_H, VIEW_W, cameraX, levelOf, newGame, start, step, type Difficulty, type Input, type PState } from './pixel/rules'
import './pixel/pixel.css'

/** Physics runs at a fixed rate, whatever the frame rate. */
const FIXED_MS = 1000 / 120
const MAX_FRAME_MS = 100

export function PixelRun({ onFinish, seed }: GameProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const runNo = useRef(0)
  const deal = useCallback((d: Difficulty) => newGame(d, createRandom(seed === undefined ? undefined : `${seed}:${runNo.current}`)), [seed])
  const [game, setGameState] = useState<PState>(() => deal('normal'))
  const [paused, setPaused] = useState(false)
  const current = useRef(game)
  const input = useRef<Input>({ ...NO_INPUT })
  const playedMs = useRef(0)
  const reported = useRef(false)
  const over = game.status === 'won' || game.status === 'lost'

  const setGame = useCallback((next: PState) => {
    current.current = next
    setGameState(next)
  }, [])

  const report = useCallback(
    (s: PState) => {
      if (reported.current) return
      reported.current = true
      onFinish({ score: s.score, durationMs: Math.round(playedMs.current), won: s.status === 'won', stats: { coins: s.coinsGot, levels: s.levelsDone, stomps: s.stomps, deaths: s.deaths, lives: s.lives } })
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
      let inp = input.current
      let stepped = false
      while (acc >= FIXED_MS && s.status === 'playing') {
        s = step(s, FIXED_MS / 1000, inp)
        inp = { ...inp, jumpPressed: false }
        stepped = true
        playedMs.current += FIXED_MS
        acc -= FIXED_MS
      }
      if (stepped) input.current = { ...input.current, jumpPressed: false }
      if (s !== current.current) {
        setGame(s)
        if (s.status === 'won' || s.status === 'lost') report(s)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [running, report, setGame])

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
    const jump = (k: string) => k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' '
    const onDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key
      if (left(k)) input.current = { ...input.current, left: true }
      else if (right(k)) input.current = { ...input.current, right: true }
      else if (jump(k)) {
        if (k === ' ' && (e.target as HTMLElement | null)?.closest?.('button, select')) return
        if (current.current.status === 'ready') begin()
        if (!e.repeat) input.current = { ...input.current, jump: true, jumpPressed: true }
      } else if (k === 'p' || k === 'P' || k === 'Escape') {
        togglePause()
        return
      } else return
      e.preventDefault()
    }
    const onUp = (e: KeyboardEvent) => {
      const k = e.key
      if (left(k)) input.current = { ...input.current, left: false }
      else if (right(k)) input.current = { ...input.current, right: false }
      else if (jump(k)) input.current = { ...input.current, jump: false }
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

  const restart = (d: Difficulty = difficulty) => {
    // A run abandoned with points still counts once, like the other games.
    if (current.current.status !== 'ready' && current.current.score > 0) report(current.current)
    reported.current = false
    playedMs.current = 0
    input.current = { ...NO_INPUT }
    runNo.current += 1
    setPaused(false)
    setDifficulty(d)
    setGame(deal(d))
  }

  /** Holding a touch button sets inputs until it is released. */
  const hold = (on: Partial<Input>, off: Partial<Input>) => ({
    onPointerDown: (e: RPointerEvent) => {
      e.preventDefault()
      begin()
      input.current = { ...input.current, ...on }
    },
    onPointerUp: () => (input.current = { ...input.current, ...off }),
    onPointerLeave: () => (input.current = { ...input.current, ...off }),
    onPointerCancel: () => (input.current = { ...input.current, ...off }),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') e.stopPropagation()
    },
  })

  const lv = levelOf(game)
  const cam = Math.round(cameraX(game) * 2) / 2
  const t0 = Math.max(0, Math.floor(cam / TILE))
  const t1 = Math.min(lv.w - 1, Math.ceil((cam + VIEW_W) / TILE))
  const tiles: React.ReactNode[] = []
  for (let ty = 0; ty < lv.h; ty++)
    for (let tx = t0; tx <= t1; tx++) {
      if (!lv.solid[ty * lv.w + tx]) continue
      const open = ty === 0 || !lv.solid[(ty - 1) * lv.w + tx]
      tiles.push(
        <g key={`${tx}:${ty}`}>
          <rect className="pr-dirt" x={tx * TILE} y={ty * TILE} width={TILE} height={TILE} />
          <rect className="pr-dirt-dk" x={tx * TILE + 3} y={ty * TILE + 7} width={3} height={3} />
          <rect className="pr-dirt-dk" x={tx * TILE + 10} y={ty * TILE + 11} width={3} height={3} />
          {open ? <rect className="pr-grass" x={tx * TILE} y={ty * TILE} width={TILE} height={4} /> : null}
        </g>,
      )
    }
  const blink = game.invuln > 0 && game.status === 'playing' && Math.floor(game.invuln * 10) % 2 === 0
  const fx = lv.flag.x * TILE
  const fy = lv.flag.y * TILE
  const stageName = lv.name
  const hearts = '♥'.repeat(Math.min(game.lives, 8)) || '–'

  return (
    <div className="pr">
      <div className="game-toolbar pr-bar">
        <div><small>Score</small><strong>{game.score}</strong></div>
        <div><small>Level</small><strong>{Math.min(game.stage + 1, game.order.length)}/{game.order.length}</strong></div>
        <div><small>Lives</small><strong aria-label={`${game.lives} lives`}>{hearts}</strong></div>
        <div><small>Time</small><strong>{Math.ceil(game.timeLeft)}</strong></div>
        <button onClick={togglePause} disabled={game.status !== 'playing'} aria-label={paused ? 'Resume' : 'Pause'}>{paused ? <Play size={15} /> : <Pause size={15} />}</button>
        <button onClick={() => restart()} aria-label="New game"><RotateCcw size={15} /></button>
      </div>
      <div
        className="pr-field"
        role="group"
        aria-label={`${stageName}, level ${game.stage + 1} of ${game.order.length}`}
        data-status={paused && game.status === 'playing' ? 'paused' : game.status}
        data-x={Math.round(game.x)}
        data-y={Math.round(game.y)}
        data-stage={game.stage}
        data-coins={game.coinsGot}
        data-lives={game.lives}
        data-levels={game.levelsDone}
        onPointerDown={begin}
      >
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} aria-hidden="true">
          <g transform={`translate(${-cam} 0)`}>
            {tiles}
            {lv.spikes.map((p) => (
              <polygon key={`s${p.x}:${p.y}`} className="pr-spike" points={`${p.x * TILE + 1},${(p.y + 1) * TILE} ${p.x * TILE + 4.5},${p.y * TILE + 7} ${p.x * TILE + 8},${(p.y + 1) * TILE} ${p.x * TILE + 11.5},${p.y * TILE + 7} ${p.x * TILE + 15},${(p.y + 1) * TILE}`} />
            ))}
            <rect className="pr-pole" x={fx + 7} y={fy - TILE} width={2} height={TILE * 2} />
            <polygon className="pr-flag" points={`${fx + 9},${fy - TILE} ${fx + 9 + 12},${fy - TILE + 5} ${fx + 9},${fy - TILE + 10}`} />
            {game.coins.map((c, i) => (c.got ? null : <ellipse key={i} className="pr-coin" cx={c.x * TILE + 8} cy={c.y * TILE + 8} rx={4} ry={5} />))}
            {game.enemies.map((e, i) =>
              e.alive ? (
                <g key={i} transform={`translate(${e.x} ${e.y})`}>
                  <rect className="pr-foe" x={0} y={3} width={EW} height={EH - 3} rx={2} />
                  <rect className="pr-foe" x={2} y={0} width={EW - 4} height={4} rx={1} />
                  <rect className="pr-eye" x={e.dir > 0 ? 6 : 2} y={4} width={4} height={3} />
                  <rect className="pr-pupil" x={e.dir > 0 ? 8 : 2} y={5} width={2} height={2} />
                </g>
              ) : (
                <rect key={i} className="pr-foe-dead" x={e.x} y={e.y + EH - 3} width={EW} height={3} />
              ),
            )}
            <g className="pr-hero" data-blink={blink || undefined} transform={`translate(${game.x} ${game.y})`}>
              <rect className="pr-hero-body" x={1} y={6} width={PW - 2} height={PH - 6} />
              <rect className="pr-hero-skin" x={1} y={1} width={PW - 2} height={6} />
              <rect className="pr-hero-cap" x={game.facing > 0 ? 0 : 1} y={0} width={PW - 1} height={3} />
              <rect className="pr-pupil" x={game.facing > 0 ? 6 : 2} y={3} width={2} height={2} />
            </g>
          </g>
        </svg>
        {game.status === 'ready' ? (
          <div className="pr-hint">
            <label>Difficulty<select aria-label="Difficulty" value={difficulty} onChange={(e) => restart(e.target.value as Difficulty)} onPointerDown={(e) => e.stopPropagation()}>{(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => <option key={d} value={d}>{DIFFICULTY[d].label}</option>)}</select></label>
            <span>Run with ←/→, jump with Space or ↑ (hold for higher). Reach the flag in all three levels.</span>
          </div>
        ) : null}
        {paused && game.status === 'playing' ? <div className="pr-hint">Paused</div> : null}
      </div>
      <div className="pr-pad" aria-label="Touch controls">
        <button type="button" aria-label="Move left" {...hold({ left: true }, { left: false })}>◀</button>
        <button type="button" aria-label="Move right" {...hold({ right: true }, { right: false })}>▶</button>
        <button type="button" aria-label="Jump" className="pr-jump" {...hold({ jump: true, jumpPressed: true }, { jump: false })}>Jump</button>
      </div>
      <p className="game-help">Run and jump to the flag. Land on walkers to squash them, avoid spikes and pits, and grab coins. Hold jump for a higher leap. P or Escape pauses.</p>
      {over ? (
        <div className="game-over">
          <h3>{game.status === 'won' ? 'All levels cleared!' : 'Out of lives'}</h3>
          <p>{game.levelsDone}/{game.order.length} levels · {game.coinsGot} coins · score {game.score}</p>
          <button className="primary-btn" onClick={() => restart()}>Play again</button>
        </div>
      ) : null}
    </div>
  )
}
