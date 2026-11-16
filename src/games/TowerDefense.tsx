import { useCallback, useEffect, useRef, useState } from 'react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import {
  COLS, ROWS, WAVES, KINDS, LEVELS as LEVEL_DATA, TOWERS, MAX_TOWER_LEVEL, WAYPOINTS, build, enemyPos, inGrid, isOver, isPath, newGame, score, startWave, step, towerAt, towerRange, upgrade, upgradeCost, wavesCleared, whyNot,
  type Level, type State, type TowerKind,
} from './tower/rules'
import './tower/tower.css'

const LEVELS: [Level, string][] = [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']]
const REASONS: Record<string, string> = { path: 'That is the enemy path.', taken: 'A tower is already there.', gold: 'Not enough gold.', edge: 'Off the board.', none: '' }
const pathD = WAYPOINTS.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ')

export function TowerDefense({ onFinish, seed }: GameProps) {
  const [base] = useState(() => seed ?? String(createRandom()()))
  const [run, setRun] = useState(0)
  const [level, setLevel] = useState<Level>('normal')
  const [game, setGameState] = useState<State>(() => newGame(`${base}-0`, 'normal'))
  const [kind, setKind] = useState<TowerKind>('basic')
  const [cursor, setCursor] = useState<[number, number]>([0, 0])
  const [picked, setPicked] = useState<[number, number] | null>(null)
  const [note, setNote] = useState('')
  const [paused, setPausedState] = useState(false)
  const [fast, setFast] = useState(false)
  const [best, setBest] = useState(0)
  const current = useRef(game)
  const cursorRef = useRef<[number, number]>([0, 0])
  const pausedRef = useRef(false)
  const fastRef = useRef(false)
  const reported = useRef(false)
  const finish = useRef(onFinish)
  finish.current = onFinish

  /** Every transition comes through here, from event handlers or the animation callback, never from a state updater. */
  const apply = useCallback((next: State) => {
    if (next === current.current) return
    current.current = next
    setGameState(next)
    if (isOver(next) && !reported.current) {
      reported.current = true
      const points = score(next)
      setBest((b) => Math.max(b, points))
      finish.current({
        score: points,
        durationMs: Math.round(next.played),
        won: next.status === 'won',
        stats: { waves: wavesCleared(next), kills: next.kills, towers: next.towers.length, lives: next.lives },
      })
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
    setPicked(null)
    setNote('')
  }

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(50, now - last)
      last = now
      if (!pausedRef.current && !isOver(current.current)) apply(step(current.current, fastRef.current ? dt * 2 : dt))
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [apply])

  const place = useCallback((c: number, r: number) => {
    const s = current.current
    if (isOver(s) || !inGrid(c, r)) return
    cursorRef.current = [c, r]
    setCursor([c, r])
    if (towerAt(s, c, r)) {
      setPicked([c, r])
      setNote('')
      return
    }
    setPicked(null)
    const why = whyNot(s, kind, c, r)
    if (why) setNote(REASONS[why] ?? '')
    else {
      setNote('')
      apply(build(s, kind, c, r))
    }
  }, [kind, apply])

  const doUpgrade = useCallback((c: number, r: number) => {
    const s = current.current
    const next = upgrade(s, c, r)
    setNote(next === s ? 'Cannot upgrade that now.' : '')
    apply(next)
  }, [apply])

  const send = useCallback(() => apply(startWave(current.current)), [apply])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if ((e.target as HTMLElement | null)?.closest?.('button')) {
        if (e.key === ' ' || e.key === 'Enter') return
      }
      const k = e.key.toLowerCase()
      if (k === 'p' || k === 'escape') {
        if (!isOver(current.current)) setPaused(!pausedRef.current)
        e.preventDefault()
        return
      }
      if (pausedRef.current) return
      let handled = true
      const move = (dc: number, dr: number) => {
        const [c, r] = cursorRef.current
        cursorRef.current = [Math.max(0, Math.min(COLS - 1, c + dc)), Math.max(0, Math.min(ROWS - 1, r + dr))]
        setCursor(cursorRef.current)
      }
      if (k === 'arrowleft') move(-1, 0)
      else if (k === 'arrowright') move(1, 0)
      else if (k === 'arrowup') move(0, -1)
      else if (k === 'arrowdown') move(0, 1)
      else if (k === '1' || k === '2' || k === '3') setKind(KINDS[Number(k) - 1])
      else if (k === 'n') send()
      else if (k === 'f') { fastRef.current = !fastRef.current; setFast(fastRef.current) }
      else if (k === 'enter' || k === ' ') place(cursorRef.current[0], cursorRef.current[1])
      else if (k === 'u') doUpgrade(cursorRef.current[0], cursorRef.current[1])
      else handled = false
      if (handled) e.preventDefault()
    }
    const hide = () => {
      if (document.hidden && !isOver(current.current)) setPaused(true)
    }
    window.addEventListener('keydown', down)
    document.addEventListener('visibilitychange', hide)
    return () => {
      window.removeEventListener('keydown', down)
      document.removeEventListener('visibilitychange', hide)
    }
  }, [place, doUpgrade, send, setPaused])

  const { status } = game
  const intro = status === 'build' && game.wave === 0 && game.towers.length === 0
  const sel = picked ? towerAt(game, picked[0], picked[1]) : undefined
  const cells: JSX.Element[] = []
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (isPath(c, r)) continue
    const t = towerAt(game, c, r)
    cells.push(
      <rect key={`${c},${r}`} className="td-cell" data-active={cursor[0] === c && cursor[1] === r} data-tower={t?.kind} data-picked={picked?.[0] === c && picked?.[1] === r}
        x={c + 0.04} y={r + 0.04} width={0.92} height={0.92} rx={0.12} role="button" tabIndex={-1} aria-label={t ? `${TOWERS[t.kind].name} tower level ${t.level} at column ${c + 1}, row ${r + 1}` : `Empty cell, column ${c + 1}, row ${r + 1}`}
        onClick={() => place(c, r)} />,
    )
  }

  return (
    <div className="td">
      <div className="td-stats">
        <span>Gold <b data-testid="td-gold">{game.gold}</b></span>
        <span>Lives <b data-testid="td-lives">{game.lives}</b></span>
        <span>Wave <b data-testid="td-wave">{Math.max(1, game.wave)}/{WAVES}</b></span>
        <span>Score <b>{score(game)}</b></span>
        {best > 0 && <span>Best <b>{best}</b></span>}
      </div>
      <div className="td-bar" role="group" aria-label="Towers">
        {KINDS.map((k, i) => (
          <button key={k} type="button" aria-pressed={kind === k} title={`${TOWERS[k].blurb}. Key ${i + 1}`} onClick={() => setKind(k)}>
            {TOWERS[k].name} <small>{TOWERS[k].cost}</small>
          </button>
        ))}
        <button type="button" className="td-send" disabled={status !== 'build'} onClick={send}>{game.wave === 0 ? 'Start wave 1' : `Send wave ${Math.min(WAVES, game.wave + 1)}`}</button>
        <button type="button" aria-pressed={fast} onClick={() => { fastRef.current = !fastRef.current; setFast(fastRef.current) }}>2x</button>
        {status !== 'won' && status !== 'lost' && <button type="button" onClick={() => setPaused(!paused)}>{paused ? 'Resume' : 'Pause'}</button>}
      </div>
      <div className="td-board" data-status={status} data-paused={paused} data-enemies={game.enemies.length} data-towers={game.towers.length}>
        <svg viewBox={`0 0 ${COLS} ${ROWS}`} role="group" aria-label={`Tower Defense board. Wave ${Math.max(1, game.wave)} of ${WAVES}, ${game.lives} lives, ${game.gold} gold.`}>
          <rect className="td-ground" width={COLS} height={ROWS} />
          <path className="td-road" d={pathD} />
          {cells}
          {game.towers.map((t) => (
            <g key={t.id} className="td-tower" data-kind={t.kind} pointerEvents="none">
              <circle cx={t.c + 0.5} cy={t.r + 0.5} r={0.34} />
              <text x={t.c + 0.5} y={t.r + 0.62} textAnchor="middle">{t.level}</text>
            </g>
          ))}
          {sel && <circle className="td-range" cx={sel.c + 0.5} cy={sel.r + 0.5} r={towerRange(sel)} pointerEvents="none" />}
          {game.shots.map((x) => <line key={x.id} className="td-shot" data-kind={x.kind} x1={x.x1} y1={x.y1} x2={x.x2} y2={x.y2} pointerEvents="none" />)}
          {game.enemies.map((e) => {
            const [x, y] = enemyPos(e)
            return (
              <g key={e.id} className="td-enemy" data-kind={e.kind} data-slow={e.slow > 0} pointerEvents="none">
                <circle cx={x} cy={y} r={e.kind === 'armoured' ? 0.32 : e.kind === 'fast' ? 0.2 : 0.26} />
                <rect x={x - 0.28} y={y - 0.42} width={0.56 * Math.max(0, e.hp / e.maxHp)} height={0.07} />
              </g>
            )
          })}
        </svg>
        {intro && !paused && (
          <div className="td-over">
            <strong>Tower Defense</strong>
            <span>Tap or click a green cell to build the chosen tower. Stop {WAVES} waves from reaching the exit. Keys: arrows move, Enter builds, U upgrades, N sends a wave, 1–3 pick a tower.</span>
            <div className="td-levels" role="group" aria-label="Level">
              {LEVELS.map(([l, t]) => <button key={l} type="button" aria-pressed={level === l} onClick={() => restart(l)}>{t}</button>)}
            </div>
            <small>{LEVEL_DATA[level].lives} lives · {LEVEL_DATA[level].gold} gold</small>
          </div>
        )}
        {paused && (
          <div className="td-over">
            <strong>Paused</strong>
            <button type="button" className="primary-btn" onClick={() => setPaused(false)}>Resume</button>
          </div>
        )}
        {isOver(game) && (
          <div className="td-over">
            <strong>{status === 'won' ? 'You held the line' : 'Overrun'}</strong>
            <span>Score {score(game)} · {wavesCleared(game)} of {WAVES} waves · {game.kills} defeated</span>
            <button type="button" className="primary-btn" onClick={() => restart()}>Play again</button>
          </div>
        )}
      </div>
      <div className="td-info" aria-live="polite">
        {sel ? (
          <>
            <span>{TOWERS[sel.kind].name} level {sel.level}</span>
            <button type="button" disabled={sel.level >= MAX_TOWER_LEVEL || game.gold < upgradeCost(sel)} onClick={() => doUpgrade(sel.c, sel.r)}>
              {sel.level >= MAX_TOWER_LEVEL ? 'Max level' : `Upgrade ${upgradeCost(sel)}`}
            </button>
          </>
        ) : (
          <span>{note || `${TOWERS[kind].name}: ${TOWERS[kind].blurb}`}</span>
        )}
      </div>
    </div>
  )
}
