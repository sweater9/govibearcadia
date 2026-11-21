import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, Settings } from 'lucide-react'
import { createRandom } from '../lib/rng'
import { playSound, type SoundName } from '../lib/sound'
import type { GameProps } from '../types'
import { CAMPAIGN_LEVELS, DIFFICULTIES, campaignLevel, endlessLevel, introduces, startLevel, type Difficulty } from './maze/levels'
import { DIRS, move, parMs, score, stars, stepMs, tick, trapActive, type Dir, type MEvent, type MState, type PowerKind } from './maze/rules'
import { ACHIEVEMENTS, readSave, recordEndless, recordLevel, writeSave, type MazeSave } from './maze/storage'
import './maze/maze.css'

type Mode = { kind: 'campaign'; n: number } | { kind: 'endless'; i: number; hearts: number; distance: number; timeMs: number; coins: number; seed: string }
type Overlay = { title: string; lines: string[]; stars?: number; next?: boolean } | null

const KEY_DIRS: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' }
const POWER_GLYPH: Record<PowerKind, string> = { speed: '»', shield: 'O', reveal: '?', time: '+', freeze: '*' }
const SOUND_FOR: Partial<Record<MEvent, SoundName>> = { eat: 'coin', coin: 'coin', key: 'key', door: 'door', hit: 'hit', power: 'power', win: 'win', lose: 'lose', locked: 'bad' }
const MESSAGE: Partial<Record<MEvent, string>> = { coin: 'Coin', key: 'Key collected', door: 'Door unlocked', locked: 'Locked. Find a key.', hit: 'Caught! Lost a heart', eat: 'Caught a chaser!', power: 'Big pellet: the chasers are scared!' }
const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

const newRunSeed = (seed?: string) => {
  if (seed) return seed
  try {
    return Array.from(crypto.getRandomValues(new Uint32Array(2)), (n) => n.toString(36)).join('')
  } catch {
    return String(Date.now())
  }
}

type RunnerProps = { init: MState; label: string; hint: string; dpad: boolean; seed: string; onEnd: (s: MState) => void; onMenu: () => void; onRestart: () => void; overlay: Overlay; onOverlay: (action: 'next' | 'retry') => void }

function Runner({ init, label, hint, dpad, seed, onEnd, onMenu, onRestart, overlay, onOverlay }: RunnerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const sRef = useRef<MState>(init)
  const rt = useRef({ held: null as Dir | null, pending: null as Dir | null, pendingAt: 0, cool: 0, started: false, paused: false, ended: false, anim: null as null | { from: { x: number; y: number }; t0: number; dur: number } })
  const random = useMemo(() => createRandom(seed), [seed])
  const [hud, setHud] = useState(() => snapshot(init, false, false))
  const [msg, setMsg] = useState('')
  const [paused, setPaused] = useState(false)
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd
  const l = init.level

  const press = useCallback((d: Dir) => {
    rt.current.pending = d
    rt.current.pendingAt = performance.now()
    rt.current.held = d
    rt.current.started = true
  }, [])
  const tap = useCallback((d: Dir) => {
    rt.current.pending = d
    rt.current.pendingAt = performance.now()
    rt.current.started = true
  }, [])
  const release = useCallback((d?: Dir) => {
    if (!d || rt.current.held === d) rt.current.held = null
  }, [])
  const togglePause = useCallback(() => {
    if (sRef.current.status !== 'playing') return
    rt.current.paused = !rt.current.paused
    setPaused(rt.current.paused)
  }, [])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const d = KEY_DIRS[e.key]
      if (d) {
        const t = e.target as HTMLElement | null
        if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return
        e.preventDefault()
        if (!rt.current.paused) press(d)
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') togglePause()
    }
    const up = (e: KeyboardEvent) => {
      const d = KEY_DIRS[e.key]
      if (d) release(d)
    }
    const hide = () => {
      if (document.hidden && sRef.current.status === 'playing' && !rt.current.paused) {
        rt.current.paused = true
        setPaused(true)
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', hide)
    document.addEventListener('visibilitychange', hide)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', hide)
      document.removeEventListener('visibilitychange', hide)
    }
  }, [press, release, togglePause])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const r = rt.current
    const frame = (now: number) => {
      const dt = Math.min(100, now - last)
      last = now
      let s = sRef.current
      if (!r.paused && s.status === 'playing' && r.started) {
        r.cool -= dt
        const dir = r.pending && now - r.pendingAt < 280 ? r.pending : r.held
        if (dir && r.cool <= 0) {
          const n = move(s, dir)
          r.pending = null
          if (n !== s) {
            if (n.p.x !== s.p.x || n.p.y !== s.p.y) r.anim = { from: s.p, t0: now, dur: stepMs(s) }
            r.cool = stepMs(n)
            s = n
            announce(s.events)
          } else announce(n.events)
        }
        const t = tick(s, dt, random)
        if (t !== s) announce(t.events)
        s = t
        sRef.current = s
      }
      draw(canvasRef.current, s, r.anim, now)
      const snap = snapshot(s, r.paused, r.started)
      setHud((h) => (h === snap || JSON.stringify(h) === JSON.stringify(snap) ? h : snap))
      if (s.status !== 'playing' && !r.ended) {
        r.ended = true
        onEndRef.current(s)
      }
      raf = requestAnimationFrame(frame)
    }
    const announce = (events: MEvent[]) => {
      for (const ev of events) {
        const snd = SOUND_FOR[ev]
        if (snd) playSound(snd)
        const m = MESSAGE[ev]
        if (m) setMsg(m)
      }
    }
    raf = requestAnimationFrame(frame)
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => sizeCanvas(canvasRef.current, boxRef.current))
    if (boxRef.current) ro?.observe(boxRef.current)
    sizeCanvas(canvasRef.current, boxRef.current)
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
    }
  }, [random])

  // Swipe or drag on the maze: a drag longer than most of a cell steps that way and keeps going while held.
  const drag = useRef<{ x: number; y: number } | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return
    drag.current = { x: e.clientX, y: e.clientY }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const a = drag.current
    if (!a) return
    const cell = (boxRef.current?.clientWidth ?? 300) / l.w
    const dx = e.clientX - a.x
    const dy = e.clientY - a.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < Math.max(14, cell * 0.6)) return
    press(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
    drag.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = () => {
    drag.current = null
    release()
  }

  const heartsText = '♥'.repeat(Math.max(0, hud.hearts)) + '♡'.repeat(Math.max(0, hud.maxHearts - hud.hearts))
  const active = [hud.scared && 'Chasers scared', hud.speed && 'Speed', hud.shield && 'Shield', hud.freeze && 'Freeze'].filter(Boolean).join(', ')
  return (
    <div className="mz-run">
      <div className="mz-hud">
        <b>{label}</b>
        <span aria-label={`${hud.hearts} of ${hud.maxHearts} hearts`} className="mz-hearts">{heartsText}</span>
        {hud.chase ? <span>Pellets left {hud.pel}</span> : null}
        {hud.chase ? <span>Score {hud.points}</span> : null}
        {hud.coinsTotal ? <span>Coins {hud.coins}/{hud.coinsTotal}</span> : null}
        {hud.doors ? <span>Keys {hud.keys}</span> : null}
        {hud.time !== null ? <span className={hud.time <= 10 ? 'mz-low' : ''}>Time {fmt(hud.time * 1000)}</span> : <span>{fmt(hud.elapsed)}</span>}
        {active ? <span>{active}</span> : null}
        <span className="mz-btns">
          <button type="button" onClick={togglePause} aria-label={paused ? 'Resume game' : 'Pause game'}>{paused ? <Play size={14} aria-hidden /> : <Pause size={14} aria-hidden />}</button>
          <button type="button" onClick={onMenu}><Settings size={14} aria-hidden /> Levels</button>
        </span>
      </div>
      <div className="mz-stage" data-x={hud.x} data-y={hud.y} data-steps={hud.steps} data-status={hud.status} data-hearts={hud.hearts} data-coins={hud.coins} data-pellets={hud.pel} data-keys={hud.keys}>
        <div className="mz-board" ref={boxRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <canvas ref={canvasRef} className="mz-canvas" role="img" aria-label={`Maze, ${l.w} by ${l.h}. You are at column ${hud.x + 1}, row ${hud.y + 1}. ${l.pellets.length ? 'Eat every pellet to clear the maze.' : `The exit is at column ${l.exit.x + 1}, row ${l.exit.y + 1}${l.fog ? ', but fog hides most of the maze' : ''}.`}`} />
          {!hud.started && hud.status === 'playing' && !overlay ? <div className="mz-ready" role="status">{hint}<br />Eat every pellet. Press an arrow key or WASD, swipe, or use the pad to start.</div> : null}
          {paused ? (
            <div className="mz-overlay" role="dialog" aria-label="Paused">
              <h3>Paused</h3>
              <div className="mz-actions"><button type="button" onClick={togglePause}>Resume</button><button type="button" onClick={onRestart}>Restart</button><button type="button" onClick={onMenu}>Levels</button></div>
            </div>
          ) : null}
          {overlay ? (
            <div className="mz-overlay" role="dialog" aria-label={overlay.title}>
              <h3>{overlay.title}</h3>
              {overlay.stars !== undefined ? <p className="mz-stars" aria-label={`${overlay.stars} of 3 stars`}>{'★'.repeat(overlay.stars)}{'☆'.repeat(3 - overlay.stars)}</p> : null}
              {overlay.lines.map((t) => <p key={t}>{t}</p>)}
              <div className="mz-actions">
                {overlay.next ? <button type="button" onClick={() => onOverlay('next')}>Next</button> : null}
                <button type="button" onClick={() => onOverlay('retry')}>{overlay.next ? 'Replay' : 'Try again'}</button>
                <button type="button" onClick={onMenu}>Levels</button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <p className="mz-msg" role="status" aria-live="polite">{msg}</p>
      {dpad ? (
        <div className="mz-pad" aria-label="On-screen pad">
          {(['up', 'left', 'down', 'right'] as Dir[]).map((d) => (
            <button
              key={d}
              type="button"
              data-dir={d}
              aria-label={`Move ${d}`}
              onPointerDown={(e) => { e.preventDefault(); press(d) }}
              onPointerUp={() => release(d)}
              onPointerLeave={() => release(d)}
              onPointerCancel={() => release(d)}
              onClick={(e) => { if (e.detail === 0) tap(d) }}
            >{{ up: '▲', left: '◀', down: '▼', right: '▶' }[d]}</button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function snapshot(s: MState, paused: boolean, started: boolean) {
  return {
    hearts: s.hearts, maxHearts: s.maxHearts, coins: s.coinsGot, coinsTotal: s.coinsGot + s.coinsLeft.length, pel: s.pelletsLeft.length + s.bigLeft.length, chase: s.level.pellets.length > 0, points: s.points, scared: s.effects.scared > 0, keys: s.keys, doors: s.level.doors.length > 0,
    time: s.timeLeft === null ? null : Math.ceil(s.timeLeft / 1000), elapsed: Math.floor(s.elapsed / 1000) * 1000,
    speed: s.effects.speed > 0, shield: s.effects.shield > 0, freeze: s.effects.freeze > 0, x: s.p.x, y: s.p.y, steps: s.steps, status: s.status, paused, started,
  }
}

function sizeCanvas(c: HTMLCanvasElement | null, box: HTMLDivElement | null) {
  if (!c || !box) return
  const size = Math.max(100, Math.floor(box.clientWidth))
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  if (c.width !== size * dpr) {
    c.width = size * dpr
    c.height = size * dpr
  }
}

function draw(c: HTMLCanvasElement | null, s: MState, anim: null | { from: { x: number; y: number }; t0: number; dur: number }, now: number) {
  const ctx = c?.getContext('2d')
  if (!c || !ctx) return
  const { w, h } = s.level
  const cell = c.width / Math.max(w, h)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, c.width, c.height)
  ctx.fillStyle = '#0b1019'
  ctx.fillRect(0, 0, c.width, c.height)
  const seen = (x: number, y: number) => s.seen[y * w + x]
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    ctx.fillStyle = seen(x, y) ? ((x + y) % 2 ? '#162131' : '#142030') : '#04060a'
    ctx.fillRect(x * cell, y * cell, cell + 0.5, cell + 0.5)
  }
  const cx = (x: number) => (x + 0.5) * cell
  // exit
  const chase = s.level.pellets.length > 0
  for (const p of s.pelletsLeft) {
    ctx.fillStyle = '#ffe9b0'
    ctx.beginPath()
    ctx.arc(cx(p.x), cx(p.y), cell * 0.09, 0, 7)
    ctx.fill()
  }
  for (const p of s.bigLeft) {
    ctx.fillStyle = '#ff9ff3'
    ctx.beginPath()
    ctx.arc(cx(p.x), cx(p.y), cell * 0.26 * (1 + 0.12 * Math.sin(now / 160)), 0, 7)
    ctx.fill()
  }
  if (!chase && seen(s.level.exit.x, s.level.exit.y)) {
    const e = s.level.exit
    ctx.fillStyle = '#2fbf71'
    ctx.fillRect(e.x * cell + cell * 0.12, e.y * cell + cell * 0.12, cell * 0.76, cell * 0.76)
    ctx.fillStyle = '#0b1019'
    ctx.font = `800 ${cell * 0.5}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('E', cx(e.x), cx(e.y) + 1)
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const t of s.level.traps) if (seen(t.x, t.y)) {
    const on = trapActive(t, s.elapsed)
    ctx.fillStyle = on ? '#ff5c6c' : '#5a2f38'
    ctx.beginPath()
    ctx.moveTo(cx(t.x), (t.y + 0.15) * cell)
    ctx.lineTo((t.x + 0.85) * cell, (t.y + 0.85) * cell)
    ctx.lineTo((t.x + 0.15) * cell, (t.y + 0.85) * cell)
    ctx.closePath()
    ctx.fill()
  }
  for (const d of s.doorsLeft) if (seen(d.x, d.y)) {
    ctx.fillStyle = '#a8642b'
    ctx.fillRect(d.x * cell + cell * 0.1, d.y * cell + cell * 0.1, cell * 0.8, cell * 0.8)
    ctx.fillStyle = '#0b1019'
    ctx.beginPath()
    ctx.arc(cx(d.x), cx(d.y) - cell * 0.08, cell * 0.12, 0, 7)
    ctx.fill()
    ctx.fillRect(cx(d.x) - cell * 0.04, cx(d.y), cell * 0.08, cell * 0.22)
  }
  for (const k of s.keysLeft) if (seen(k.x, k.y)) {
    ctx.strokeStyle = '#ffd166'
    ctx.lineWidth = Math.max(2, cell * 0.1)
    ctx.beginPath()
    ctx.arc(cx(k.x) - cell * 0.15, cx(k.y), cell * 0.16, 0, 7)
    ctx.moveTo(cx(k.x), cx(k.y))
    ctx.lineTo(cx(k.x) + cell * 0.28, cx(k.y))
    ctx.moveTo(cx(k.x) + cell * 0.2, cx(k.y))
    ctx.lineTo(cx(k.x) + cell * 0.2, cx(k.y) + cell * 0.15)
    ctx.stroke()
  }
  for (const co of s.coinsLeft) if (seen(co.x, co.y)) {
    ctx.fillStyle = '#ffc247'
    ctx.beginPath()
    ctx.arc(cx(co.x), cx(co.y), cell * 0.22 * (1 + 0.06 * Math.sin(now / 220 + co.x)), 0, 7)
    ctx.fill()
  }
  for (const p of s.powersLeft) if (seen(p.x, p.y)) {
    ctx.fillStyle = '#b388ff'
    ctx.beginPath()
    ctx.arc(cx(p.x), cx(p.y), cell * 0.3, 0, 7)
    ctx.fill()
    ctx.fillStyle = '#0b1019'
    ctx.font = `800 ${cell * 0.42}px sans-serif`
    ctx.fillText(POWER_GLYPH[p.kind], cx(p.x), cx(p.y) + 1)
  }
  // walls
  ctx.strokeStyle = '#6fd3ff'
  ctx.lineWidth = Math.max(2, cell * 0.1)
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!seen(x, y)) continue
    const m = s.level.walls[y * w + x]
    const x0 = x * cell
    const y0 = y * cell
    const seg = (ax: number, ay: number, bx: number, by: number) => {
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
    }
    if (m & DIRS.up.bit) seg(x0, y0, x0 + cell, y0)
    if (m & DIRS.left.bit) seg(x0, y0, x0, y0 + cell)
    if (m & DIRS.down.bit) seg(x0, y0 + cell, x0 + cell, y0 + cell)
    if (m & DIRS.right.bit) seg(x0 + cell, y0, x0 + cell, y0 + cell)
  }
  ctx.stroke()
  // enemies
  for (const e of s.enemies) if (seen(e.x, e.y)) {
    ctx.fillStyle = s.effects.scared > 0 ? (s.effects.scared < 2000 && Math.floor(now / 150) % 2 === 0 ? '#ffffff' : '#3a5bff') : s.effects.freeze > 0 ? '#9fd8f2' : '#c25cff'
    ctx.fillRect(e.x * cell + cell * 0.18, e.y * cell + cell * 0.18, cell * 0.64, cell * 0.64)
    ctx.fillStyle = '#0b1019'
    ctx.fillRect(cx(e.x) - cell * 0.2, cx(e.y) - cell * 0.12, cell * 0.12, cell * 0.14)
    ctx.fillRect(cx(e.x) + cell * 0.08, cx(e.y) - cell * 0.12, cell * 0.12, cell * 0.14)
  }
  // player, eased from the previous cell
  let px = s.p.x
  let py = s.p.y
  if (anim) {
    const k = Math.min(1, (now - anim.t0) / anim.dur)
    px = anim.from.x + (s.p.x - anim.from.x) * k
    py = anim.from.y + (s.p.y - anim.from.y) * k
  }
  const blink = s.effects.hurt > 0 && Math.floor(now / 90) % 2 === 0
  if (!blink) {
    ctx.fillStyle = '#4cc9f0'
    ctx.beginPath()
    ctx.arc((px + 0.5) * cell, (py + 0.5) * cell, cell * 0.3, 0, 7)
    ctx.fill()
    ctx.fillStyle = '#0b1019'
    ctx.beginPath()
    ctx.arc((px + 0.5) * cell + cell * 0.08, (py + 0.5) * cell - cell * 0.05, cell * 0.06, 0, 7)
    ctx.fill()
  }
  if (s.effects.shield > 0) {
    ctx.strokeStyle = '#7bffb0'
    ctx.lineWidth = Math.max(2, cell * 0.07)
    ctx.beginPath()
    ctx.arc((px + 0.5) * cell, (py + 0.5) * cell, cell * 0.42, 0, 7)
    ctx.stroke()
  }
  // fog: cells you have seen but are not near are dimmed
  if (s.level.fog) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (seen(x, y) && Math.hypot(x - s.p.x, y - s.p.y) > s.level.fog) ctx.fillRect(x * cell, y * cell, cell, cell)
  }
}

export function MazeRunner({ onFinish, seed }: GameProps) {
  const [save, setSave] = useState<MazeSave>(readSave)
  const [screen, setScreen] = useState<'play' | 'menu'>('play')
  const [mode, setMode] = useState<Mode>(() => ({ kind: 'campaign', n: Math.min(CAMPAIGN_LEVELS, readSave().unlocked) }))
  const [attempt, setAttempt] = useState(0)
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [banner, setBanner] = useState('')
  const saveRef = useRef(save)
  saveRef.current = save
  const difficulty = save.settings.difficulty

  const init = useMemo<MState>(() => {
    if (mode.kind === 'campaign') return startLevel(campaignLevel(mode.n), difficulty)
    return startLevel(endlessLevel(mode.seed, mode.i), difficulty, mode.hearts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, attempt, difficulty])

  const commit = useCallback((s: MazeSave) => {
    setSave(s)
    writeSave(s)
  }, [])
  const patchSettings = (p: Partial<MazeSave['settings']>) => commit({ ...save, settings: { ...save.settings, ...p } })

  const play = (m: Mode) => {
    setMode(m)
    setAttempt((a) => a + 1)
    setOverlay(null)
    setBanner('')
    setScreen('play')
  }
  const startEndless = () => play({ kind: 'endless', i: 0, hearts: DIFFICULTIES[difficulty].hearts, distance: 0, timeMs: 0, coins: 0, seed: newRunSeed(seed) })

  const onEnd = useCallback(
    (s: MState) => {
      const cur = saveRef.current
      if (mode.kind === 'campaign') {
        const st = stars(s)
        const sc = score(s)
        const won = s.status === 'won'
        let lines: string[]
        if (won) {
          const { save: next, earned } = recordLevel(cur, { n: mode.n, stars: st, ms: s.elapsed, score: sc, coins: s.coinsGot + s.pelletsGot, hits: s.hitsTaken, doors: s.level.doors.length, fog: s.level.fog > 0, eaten: s.eaten })
          commit(next)
          lines = [`Time ${fmt(s.elapsed)} (par ${fmt(parMs(s.level))}). Chasers caught ${s.eaten}. Score ${sc}.`, ...earned.map((id) => `Achievement: ${ACHIEVEMENTS.find((a) => a.id === id)?.title}`)]
          setOverlay({ title: mode.n === CAMPAIGN_LEVELS ? 'Maze master!' : 'Level cleared', stars: st, lines, next: mode.n < CAMPAIGN_LEVELS })
        } else {
          setOverlay({ title: s.reason === 'time' ? 'Time ran out' : 'Out of hearts', lines: [`Pellets eaten ${s.pelletsGot}. Score ${sc}.`] })
        }
        onFinish({ score: sc, durationMs: Math.round(s.elapsed), won, stats: { level: mode.n, stars: st, pellets: s.pelletsGot, caught: s.eaten, hearts: s.hearts, steps: s.steps, hits: s.hitsTaken, difficulty: ['practice', 'easy', 'normal', 'hard'].indexOf(difficulty) } })
        return
      }
      const distance = mode.distance + s.steps
      const timeMs = mode.timeMs + s.elapsed
      const coins = mode.coins + s.pelletsGot
      if (s.status === 'won') {
        const hearts = Math.min(5, s.hearts + ((mode.i + 1) % 3 === 0 ? 1 : 0))
        setMode({ ...mode, i: mode.i + 1, hearts, distance, timeMs, coins })
        setBanner(`Maze ${mode.i + 1} cleared`)
        return
      }
      const run = { mazes: mode.i, distance, timeMs: Math.round(timeMs), day: new Date().toISOString().slice(0, 10) }
      const { save: next, earned, best } = recordEndless(cur, run)
      commit(next)
      const sc = mode.i * 100 + coins
      setOverlay({ title: s.reason === 'time' ? 'Time ran out' : 'Out of hearts', lines: [`${mode.i} maze${mode.i === 1 ? '' : 's'} cleared, ${distance} steps, ${fmt(timeMs)}.`, ...(best ? ['New personal best!'] : []), ...earned.map((id) => `Achievement: ${ACHIEVEMENTS.find((a) => a.id === id)?.title}`)] })
      onFinish({ score: sc, durationMs: Math.round(timeMs), stats: { mazes: mode.i, distance, coins, difficulty: ['practice', 'easy', 'normal', 'hard'].indexOf(difficulty) } })
    },
    [mode, commit, onFinish, difficulty],
  )

  if (screen === 'menu') {
    const best = save.endless.top[0]
    return (
      <div className="mz-menu">
        <div className="mz-top"><button type="button" onClick={() => setScreen('play')}>Back to the maze</button></div>
        <h3>Campaign</h3>
        <div className="mz-levels" role="group" aria-label="Campaign levels">
          {Array.from({ length: CAMPAIGN_LEVELS }, (_, i) => i + 1).map((n) => {
            const r = save.levels[n]
            const locked = n > save.unlocked
            return (
              <button key={n} type="button" disabled={locked} data-level={n} aria-label={`Level ${n}${locked ? ', locked' : r ? `, ${r.stars} of 3 stars` : ''}`} onClick={() => play({ kind: 'campaign', n })} title={introduces(n) ?? undefined}>
                <span>{n}</span>
                <small>{locked ? '🔒' : r ? '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars) : '·'}</small>
              </button>
            )
          })}
        </div>
        <h3>How to play</h3>
        <ul className="mz-help">
          <li>You are the <b>blue dot</b>. Move with the arrow keys or WASD, swipe, or use the pad.</li>
          <li>Eat every <b>small pellet</b> in the maze to clear it. Each is 10 points.</li>
          <li><b>Purple squares</b> are chasers. If one catches you, you lose a heart and restart from the start square.</li>
          <li>A <b>big pink pellet</b> turns the chasers blue for a few seconds. Touch a blue chaser to eat it (200 points, more for each one in a row). It goes back to its home.</li>
          <li>Stars: clear the maze; clear it without being caught; clear it fast.</li>
          <li>Too hard? Pick <b>Practice</b> in Settings for no chasers.</li>
        </ul>
        <h3>Endless maze</h3>
        <p>A new maze every time with more and faster chasers as you go. Hearts carry over; a heart comes back every third maze. {best ? `Your best: ${best.mazes} mazes.` : ''}</p>
        <div className="mz-actions"><button type="button" onClick={startEndless}>Start Endless</button></div>
        {save.endless.top.length ? (
          <ol className="mz-top10" aria-label="Personal bests">
            {save.endless.top.map((r, i) => <li key={i}>{r.mazes} mazes, {r.distance} steps, {fmt(r.timeMs)} ({r.day})</li>)}
          </ol>
        ) : null}
        <h3>Settings</h3>
        <label>Difficulty<select value={difficulty} onChange={(e) => patchSettings({ difficulty: e.target.value as Difficulty })}>{(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => <option key={d} value={d}>{DIFFICULTIES[d].label}</option>)}</select></label>
        <label className="mz-check"><input type="checkbox" checked={save.settings.dpad} onChange={(e) => patchSettings({ dpad: e.target.checked })} />Show the on-screen pad</label>
        <h3>Achievements</h3>
        <ul className="mz-ach">
          {ACHIEVEMENTS.map((a) => <li key={a.id} data-earned={save.achievements.includes(a.id)}>{save.achievements.includes(a.id) ? '✔' : '○'} <b>{a.title}</b>: {a.how}</li>)}
        </ul>
        <p className="mz-note">Progress is kept on this device only. Coins collected so far: {save.coins}.</p>
      </div>
    )
  }

  const label = mode.kind === 'campaign' ? `Level ${mode.n}` : `Maze ${mode.i + 1}`
  const hint = mode.kind === 'campaign' ? introduces(mode.n) ?? `Level ${mode.n}` : banner || 'Endless maze'
  return (
    <Runner
      key={`${mode.kind}-${mode.kind === 'campaign' ? mode.n : mode.i}-${attempt}`}
      init={init}
      label={label}
      hint={hint}
      dpad={save.settings.dpad}
      seed={`${seed ?? 'maze'}:${mode.kind}:${mode.kind === 'campaign' ? mode.n : mode.i}:${attempt}`}
      onEnd={onEnd}
      onMenu={() => setScreen('menu')}
      onRestart={() => (mode.kind === 'campaign' ? play(mode) : startEndless())}
      overlay={overlay}
      onOverlay={(a) => {
        if (a === 'next' && mode.kind === 'campaign') play({ kind: 'campaign', n: mode.n + 1 })
        else if (mode.kind === 'campaign') play(mode)
        else startEndless()
      }}
    />
  )
}
