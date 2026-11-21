import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Settings, Undo2 } from 'lucide-react'
import { byStrength, computerLabel, parseComputer } from '../lib/computerPlayers'
import { createRandom } from '../lib/rng'
import { playSound } from '../lib/sound'
import type { GameProps } from '../types'
import { MAX_SIZE, MIN_SIZE, aiMove, edgeBoxes, edgeDots, hCount, isDrawn, newGame, play, undoToHuman, undoTurn, type DState, type Level, type Player } from './dots/rules'
import { readStats, record, writeStats, type DotsStats } from './dots/storage'
import './dots/dots.css'

type Mode = 'cpu' | 'two'
type Setup = { mode: Mode; rows: number; cols: number; level: Level; cpuFirst: boolean }
const DEFAULTS: Setup = { mode: 'cpu', rows: 4, cols: 4, level: 'medium', cpuFirst: false }
const PRESETS = [3, 4, 5, 6]
const CPU_DELAY = 550
const CELL = 40
const PAD = 14
const LEVELS: Level[] = ['easy', 'medium', 'hard']

export function DotsAndBoxes({ onFinish, seed, computer }: GameProps) {
  const named = parseComputer(computer ?? null)
  const initial = useMemo<Setup>(() => (named ? { ...DEFAULTS, level: byStrength<Level>(named, ['easy', 'easy', 'medium', 'hard', 'hard'], 'medium') } : DEFAULTS), [named])
  const [setup, setSetup] = useState<Setup>(initial)
  const [draft, setDraft] = useState<Setup>(initial)
  const [screen, setScreen] = useState<'game' | 'setup'>('game')
  const [game, setGame] = useState<DState>(() => newGame(initial.rows, initial.cols, 1))
  const [run, setRun] = useState(0)
  const [stats, setStats] = useState<DotsStats>(readStats)
  const [fresh, setFresh] = useState(-1)
  const [showLog, setShowLog] = useState(false)
  const random = useMemo(() => createRandom(seed === undefined ? undefined : `${seed}:${run}`), [seed, run])
  const startedAt = useRef(Date.now())
  const reported = useRef(-1)
  const refocus = useRef(-1)
  const boardRef = useRef<SVGSVGElement>(null)

  // After a keyboard move the drawn line disappears from the tab order; keep focus on the next open line.
  useEffect(() => {
    if (refocus.current < 0) return
    const from = refocus.current
    refocus.current = -1
    const open = [...(boardRef.current?.querySelectorAll<SVGElement>('[data-edge]') ?? [])]
    const next = open.find((el) => Number(el.getAttribute('data-edge')) > from) ?? open[0]
    next?.focus()
  }, [game.log.length])

  const cpu = setup.mode === 'cpu'
  const me: Player = 1
  const name = (p: Player) => (cpu ? (p === me ? 'You' : named ? computerLabel(named) : 'Computer') : `Player ${p}`)
  const cpuTurn = cpu && !game.over && game.turn !== me

  const begin = useCallback((s: Setup) => {
    setSetup(s)
    setGame(newGame(s.rows, s.cols, s.mode === 'cpu' && s.cpuFirst ? 2 : 1))
    setRun((r) => r + 1)
    setFresh(-1)
    setShowLog(false)
    startedAt.current = Date.now()
  }, [])

  const draw = useCallback(
    (edge: number) => {
      setGame((g) => play(g, edge))
      setFresh(edge)
    },
    [],
  )

  const click = (edge: number) => {
    if (screen !== 'game' || game.over || cpuTurn || isDrawn(game, edge)) return
    const before = game.scores[0] + game.scores[1]
    const n = play(game, edge)
    playSound(n.scores[0] + n.scores[1] > before ? 'good' : 'tap')
    draw(edge)
  }

  // The computer's turn, after a short pause so each line can be followed. An extra turn simply runs this again.
  useEffect(() => {
    if (screen !== 'game' || !cpuTurn) return
    const t = setTimeout(() => {
      const edge = aiMove(game, setup.level, random)
      playSound(play(game, edge).scores[1] > game.scores[1] ? 'good' : 'move')
      draw(edge)
    }, CPU_DELAY)
    return () => clearTimeout(t)
  }, [screen, cpuTurn, game, setup.level, random, draw])

  // Report the finished game once, from an effect (never from a state updater).
  useEffect(() => {
    if (!game.over || reported.current === run) return
    reported.current = run
    const [a, b] = game.scores
    const won = a > b
    playSound(cpu ? (won ? 'win' : a === b ? 'tap' : 'lose') : 'win')
    if (cpu) {
      const upd = record(stats, { day: new Date().toISOString().slice(0, 10), size: `${game.rows}x${game.cols}`, level: setup.level, you: a, them: b, result: won ? 'win' : a === b ? 'draw' : 'loss' })
      setStats(upd)
      writeStats(upd)
    }
    onFinish({
      score: a,
      durationMs: Math.max(0, Date.now() - startedAt.current),
      won: cpu ? won : a !== b,
      stats: { boxes: a, opponent: b, size: game.rows * game.cols, moves: game.log.length, level: LEVELS.indexOf(setup.level) + 1, twoPlayer: cpu ? 0 : 1 },
    })
  }, [game, run, cpu, stats, setup.level, onFinish])

  const undo = () => {
    if (game.log.length === 0 || screen !== 'game' || game.over) return
    setGame(cpu ? undoToHuman(game, me) : undoTurn(game))
    setFresh(-1)
  }

  const w = game.cols * CELL + PAD * 2
  const h = game.rows * CELL + PAD * 2
  const dot = (r: number, c: number) => ({ x: PAD + c * CELL, y: PAD + r * CELL })
  const hc = hCount(game.rows, game.cols)
  const [a, b] = game.scores

  const edgeLabel = (e: number) => {
    const [[r1, c1], [r2, c2]] = edgeDots(game.rows, game.cols, e)
    return `${e < hc ? 'Horizontal' : 'Vertical'} line, dot row ${r1 + 1} column ${c1 + 1} to row ${r2 + 1} column ${c2 + 1}${isDrawn(game, e) ? ', drawn' : ''}`
  }
  const status = game.over
    ? a === b
      ? `A draw, ${a} boxes each.`
      : `${name(a > b ? 1 : 2)} ${cpu && a > b ? 'win' : 'wins'}, ${Math.max(a, b)} to ${Math.min(a, b)}.`
    : cpuTurn
      ? `${name(game.turn)} is thinking...`
      : `${name(game.turn)}${cpu ? ' - your turn' : ''}${game.log.length && game.log[game.log.length - 1].gained.length && game.log[game.log.length - 1].by === game.turn ? ' (extra turn)' : ''}`

  if (screen === 'setup') {
    const custom = !PRESETS.includes(draft.rows) || draft.rows !== draft.cols
    return (
      <div className="db-setup">
        <label>Opponent<select value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value as Mode })}><option value="cpu">The computer</option><option value="two">A friend on this device</option></select></label>
        <fieldset>
          <legend>Board size (boxes)</legend>
          <div className="db-chips">
            {PRESETS.map((n) => <button key={n} type="button" aria-pressed={draft.rows === n && draft.cols === n} onClick={() => setDraft({ ...draft, rows: n, cols: n })}>{n} x {n}</button>)}
            <button type="button" aria-pressed={custom} onClick={() => setDraft({ ...draft, rows: draft.rows === draft.cols && PRESETS.includes(draft.rows) ? 3 : draft.rows, cols: draft.rows === draft.cols && PRESETS.includes(draft.rows) ? 5 : draft.cols })}>Custom</button>
          </div>
          {custom ? (
            <div className="db-custom">
              <label>Rows<input type="number" min={MIN_SIZE} max={MAX_SIZE} value={draft.rows} onChange={(e) => setDraft({ ...draft, rows: Math.min(MAX_SIZE, Math.max(MIN_SIZE, Number(e.target.value) || MIN_SIZE)) })} /></label>
              <label>Columns<input type="number" min={MIN_SIZE} max={MAX_SIZE} value={draft.cols} onChange={(e) => setDraft({ ...draft, cols: Math.min(MAX_SIZE, Math.max(MIN_SIZE, Number(e.target.value) || MIN_SIZE)) })} /></label>
            </div>
          ) : null}
        </fieldset>
        {draft.mode === 'cpu' ? (
          <>
            <label>Computer level<select value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value as Level })}><option value="easy">Easy: random lines</option><option value="medium">Medium: takes boxes, avoids giving them</option><option value="hard">Hard: plans the chains</option></select></label>
            <label className="db-check"><input type="checkbox" checked={draft.cpuFirst} onChange={(e) => setDraft({ ...draft, cpuFirst: e.target.checked })} />Computer goes first</label>
          </>
        ) : null}
        <div className="db-actions">
          <button type="button" onClick={() => { begin(draft); setScreen('game') }}>Start</button>
          <button type="button" onClick={() => setScreen('game')}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="db" style={{ ['--p1' as string]: '#4cc9f0', ['--p2' as string]: '#ffb703' }}>
      <div className="db-top">
        <div className="db-score" aria-live="polite">
          <span data-p="1" data-turn={!game.over && game.turn === 1}>{name(1)}: <b>{a}</b></span>
          <span data-p="2" data-turn={!game.over && game.turn === 2}>{name(2)}: <b>{b}</b></span>
          <span>{game.rows * game.cols - a - b} left</span>
        </div>
        <div className="db-btns">
          <button type="button" onClick={undo} disabled={game.log.length === 0 || game.over}><Undo2 size={14} aria-hidden /> Undo</button>
          <button type="button" onClick={() => setShowLog((v) => !v)} aria-pressed={showLog}>History</button>
          <button type="button" onClick={() => { setDraft(setup); setScreen('setup') }}><Settings size={14} aria-hidden /> New game</button>
        </div>
      </div>
      <p className="db-status" role="status">{status}</p>
      <svg ref={boardRef} className="db-board" viewBox={`0 0 ${w} ${h}`} role="group" aria-label={`Dots and Boxes board, ${game.rows} by ${game.cols} boxes`}>
        {game.boxes.map((o, i) => {
          const r = Math.floor(i / game.cols)
          const c = i % game.cols
          const p = dot(r, c)
          return <rect key={i} className="db-box" data-owner={o} x={p.x + 2} y={p.y + 2} width={CELL - 4} height={CELL - 4} rx="4" />
        })}
        {game.boxes.map((o, i) => {
          if (!o) return null
          const p = dot(Math.floor(i / game.cols), i % game.cols)
          return <text key={'t' + i} className="db-mark" data-owner={o} x={p.x + CELL / 2} y={p.y + CELL / 2 + 4} textAnchor="middle">{cpu ? (o === me ? 'Y' : 'C') : o}</text>
        })}
        {game.lines.map((o, e) => {
          const [[r1, c1], [r2, c2]] = edgeDots(game.rows, game.cols, e)
          const a1 = dot(r1, c1)
          const a2 = dot(r2, c2)
          const nearDone = o && edgeBoxes(game.rows, game.cols, e).some((bx) => game.boxes[bx] !== 0)
          return (
            <g key={e}>
              {o ? <line className="db-line" data-owner={o} data-new={fresh === e} data-done={nearDone ? '1' : '0'} x1={a1.x} y1={a1.y} x2={a2.x} y2={a2.y} /> : <line className="db-ghost" x1={a1.x} y1={a1.y} x2={a2.x} y2={a2.y} />}
              {!o && !game.over ? (
                <line
                  className="db-hit"
                  data-edge={e}
                  role="button"
                  tabIndex={0}
                  aria-label={edgeLabel(e)}
                  aria-disabled={cpuTurn || undefined}
                  x1={a1.x} y1={a1.y} x2={a2.x} y2={a2.y}
                  onClick={() => click(e)}
                  onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); refocus.current = e; click(e) } }}
                />
              ) : null}
            </g>
          )
        })}
        {Array.from({ length: game.rows + 1 }, (_, r) => Array.from({ length: game.cols + 1 }, (_, c) => { const p = dot(r, c); return <circle key={`${r}-${c}`} className="db-dot" cx={p.x} cy={p.y} r="3.4" /> }))}
      </svg>
      <p className="db-help">Click or press Enter on a line between two dots. Finish a box to take it and move again.</p>
      {game.over ? (
        <div className="db-actions">
          <button type="button" onClick={() => begin(setup)}>Play again</button>
          <button type="button" onClick={() => { setDraft(setup); setScreen('setup') }}>Change settings</button>
        </div>
      ) : null}
      {showLog ? (
        <ol className="db-log" aria-label="Move history">
          {game.log.length === 0 ? <li>No lines yet.</li> : game.log.map((m, i) => <li key={i}>{name(m.by)} drew a line{m.gained.length ? ` and took ${m.gained.length} box${m.gained.length > 1 ? 'es' : ''}` : ''}.</li>)}
        </ol>
      ) : null}
      {cpu ? <p className="db-stats">Record: {stats.wins} won, {stats.losses} lost, {stats.draws} drawn{stats.history.length ? `. Recent: ${stats.history.slice(-5).map((e) => `${e.result === 'win' ? 'W' : e.result === 'loss' ? 'L' : 'D'} ${e.you}-${e.them} (${e.size}, ${e.level})`).join(', ')}` : ''}</p> : null}
    </div>
  )
}
