import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { SIZE, aiMove, apply, isOver, newGame, pawnMoves, scoreFor, wallLegal, type Level, type Move, type Orient, type QState, type Wall } from './quoridor/rules'
import './quoridor/quoridor.css'

/** Pause before the computer answers, so the player can follow. */
const THINK_MS = 500
type Mode = Level | 'two'
const MODES: [Mode, string][] = [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard'], ['two', 'Two players']]
const ARROWS: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }

export function Quoridor({ onFinish, seed }: GameProps) {
  const [mode, setMode] = useState<Mode>('normal')
  const [run, setRun] = useState(0)
  const base = seed ?? 'quoridor'
  const random = useMemo(() => createRandom(`${base}:${run}`), [base, run])
  const [game, setGame] = useState<QState>(() => newGame())
  const [placing, setPlacing] = useState(false)
  const [orient, setOrient] = useState<Orient>('h')
  const [preview, setPreview] = useState<{ r: number; c: number } | null>(null)
  const startedAt = useRef(0)
  const over = isOver(game)
  const vsComputer = mode !== 'two'
  const thinking = !over && vsComputer && game.turn === 2
  const myTurn = !over && !thinking

  // A run is reported once, from the handler or timer that ends it, never from a state updater.
  // Games on one screen between two people are not scored, so they cannot set a personal best.
  const commit = useCallback(
    (next: QState) => {
      setGame(next)
      setPreview(null)
      if (isOver(next) && mode !== 'two') {
        onFinish({
          score: scoreFor(next),
          durationMs: Date.now() - startedAt.current,
          won: next.winner === 1,
          stats: { moves: next.moves, walls: 10 - next.left[0], outcome: next.winner === 1 ? 1 : -1 },
        })
      }
    },
    [onFinish, mode],
  )

  const play = useCallback(
    (m: Move) => {
      if (game.moves === 0) startedAt.current = Date.now()
      commit(apply(game, m))
    },
    [game, commit],
  )

  useEffect(() => {
    if (!thinking) return
    const timer = setTimeout(() => {
      const m = aiMove(game, random, mode as Level)
      if (m) commit(apply(game, m))
    }, THINK_MS)
    return () => clearTimeout(timer)
  }, [thinking, game, random, mode, commit])

  const dests = useMemo(() => (myTurn && !placing ? pawnMoves(game, game.turn) : []), [game, myTurn, placing])
  const destSet = useMemo(() => new Set(dests.map((p) => `${p.r},${p.c}`)), [dests])
  const wall: Wall | null = preview ? { ...preview, o: orient } : null
  const wallOk = wall ? wallLegal(game, wall) : false
  const canWall = myTurn && game.left[game.turn - 1] > 0

  const placeWall = () => {
    if (wall && wallOk) play({ type: 'wall', wall })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || !myTurn) return
      const k = e.key
      if (k === 'w' || k === 'W') setPlacing((p) => (canWall ? !p : false))
      else if (k === 'r' || k === 'R') setOrient((o) => (o === 'h' ? 'v' : 'h'))
      else if (k === 'Escape') {
        setPreview(null)
        setPlacing(false)
      } else if (ARROWS[k] && !placing) {
        const me = game.pawns[game.turn - 1]
        const [dr, dc] = ARROWS[k]
        const hit = dests.filter((p) => Math.sign(p.r - me.r) === dr && Math.sign(p.c - me.c) === dc && (dr === 0 ? p.r === me.r : p.c === me.c))
        if (hit.length === 1) {
          e.preventDefault()
          play({ type: 'pawn', to: hit[0] })
        }
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [game, dests, myTurn, placing, canWall, play])

  const restart = (m: Mode = mode) => {
    setMode(m)
    setRun((r) => r + 1)
    setGame(newGame())
    setPlacing(false)
    setPreview(null)
    startedAt.current = 0
  }

  const names = vsComputer ? ['You', 'Computer'] : ['Player 1', 'Player 2']
  const status = over ? (vsComputer ? (game.winner === 1 ? 'You win!' : 'Computer wins') : `${names[game.winner - 1]} wins!`) : thinking ? 'Computer is thinking…' : `${vsComputer ? 'Your move' : `${names[game.turn - 1]}'s move`}: ${placing ? 'place a wall' : 'move your pawn'}`

  const cells = []
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const pawn = game.pawns[0].r === r && game.pawns[0].c === c ? 1 : game.pawns[1].r === r && game.pawns[1].c === c ? 2 : 0
      const go = destSet.has(`${r},${c}`)
      cells.push(
        <button
          key={`c${r}-${c}`}
          className="qr-cell"
          data-r={r}
          data-c={c}
          data-go={go ? 'true' : undefined}
          style={{ gridRow: 2 * r + 1, gridColumn: 2 * c + 1 }}
          disabled={!go}
          onClick={() => play({ type: 'pawn', to: { r, c } })}
          aria-label={`row ${r + 1}, column ${c + 1}${pawn ? `, ${pawn === 1 ? 'red' : 'blue'} pawn` : ''}${go ? ', move here' : ''}`}
        >
          {pawn ? <span className="qr-pawn" data-p={pawn} /> : null}
        </button>,
      )
    }

  const wallEl = (w: Wall, key: string, extra?: object) => (
    <div
      key={key}
      className="qr-wall"
      data-wall={`${w.o}${w.r}${w.c}`}
      style={w.o === 'h' ? { gridRow: 2 * w.r + 2, gridColumn: `${2 * w.c + 1} / span 3` } : { gridColumn: 2 * w.c + 2, gridRow: `${2 * w.r + 1} / span 3` }}
      {...extra}
    />
  )

  return (
    <div className="qr">
      <div className="game-toolbar c4-bar">
        <div>
          <small>Turn</small>
          <strong className="c4-status" aria-live="polite">{status}</strong>
        </div>
        <button onClick={() => restart()}><RotateCcw size={15} />New</button>
      </div>
      <div className="qr-opts">
        <label>Opponent<select aria-label="Opponent" value={mode} onChange={(e) => restart(e.target.value as Mode)}>{MODES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
        <button aria-pressed={placing} disabled={!canWall && !placing} onClick={() => { setPlacing((p) => !p); setPreview(null) }}>{placing ? 'Placing walls' : 'Place a wall'}</button>
        {placing ? <button onClick={() => setOrient((o) => (o === 'h' ? 'v' : 'h'))} aria-label="Rotate wall">Rotate: {orient === 'h' ? 'across' : 'down'}</button> : null}
        {placing ? <button disabled={!wall || !wallOk} onClick={placeWall}>Place wall</button> : null}
      </div>
      <div className="qr-stats" aria-label="Walls left">
        <span data-turn={!over && game.turn === 2 ? 'true' : undefined}>{names[1]} (blue, top): <b>{game.left[1]}</b> walls</span>
        <span data-turn={!over && game.turn === 1 ? 'true' : undefined}>{names[0]} (red, bottom): <b>{game.left[0]}</b> walls</span>
      </div>
      <div className="qr-board" role="group" aria-label="Quoridor board">
        {cells}
        {game.walls.map((w, i) => wallEl(w, `w${i}`))}
        {placing && wall ? wallEl(wall, 'preview', { 'data-preview': wallOk ? 'ok' : 'bad' }) : null}
        {placing && canWall
          ? Array.from({ length: 64 }, (_, i) => {
              const r = Math.floor(i / 8)
              const c = i % 8
              return (
                <button
                  key={`a${i}`}
                  className="qr-anchor"
                  data-anchor={`${r}-${c}`}
                  style={{ gridRow: 2 * r + 2, gridColumn: 2 * c + 2 }}
                  aria-label={`${orient === 'h' ? 'Horizontal' : 'Vertical'} wall after row ${r + 1}, column ${c + 1}`}
                  onPointerEnter={(e) => e.pointerType === 'mouse' && setPreview({ r, c })}
                  onFocus={() => setPreview({ r, c })}
                  onClick={(e) => {
                    const touch = (e.nativeEvent as PointerEvent).pointerType === 'touch' || (e.nativeEvent as PointerEvent).pointerType === 'pen'
                    const same = preview?.r === r && preview?.c === c
                    if (touch && !same) setPreview({ r, c })
                    else if (wallLegal(game, { r, c, o: orient })) play({ type: 'wall', wall: { r, c, o: orient } })
                    else setPreview({ r, c })
                  }}
                />
              )
            })
          : null}
      </div>
      <p className="game-help">Get your pawn to the far side first. Arrow keys or tap a highlighted square to step; you can jump an adjacent pawn. Or place a wall (W) to slow your opponent: rotate with R, tap twice or press Place wall. Walls may never block every path.</p>
      {over ? (
        <div className="game-over">
          <h3>{status}</h3>
          <p>{game.moves} moves{vsComputer ? ` · score ${scoreFor(game)}` : ''}</p>
          <button className="primary-btn" onClick={() => restart()}>Play again</button>
        </div>
      ) : null}
    </div>
  )
}
