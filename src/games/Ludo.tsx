import { useEffect, useRef, useState } from 'react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { GRID, HOME_COLUMN, RING, YARD, cellOf, isSafeRing, startIndex } from './ludo/board'
import { chooseAction } from './ludo/bot'
import { applyAction, homeCount, legalMoves, newGame, type Action, type State } from './ludo/rules'
import { loadMatch, saveMatch } from './ludo/save'
import './ludo/ludo.css'

const SEATS = [
  { colour: 'Red', hex: '#c0392b', soft: '#f3d2cb' },
  { colour: 'Green', hex: '#3f9b6b', soft: '#cfe9da' },
  { colour: 'Gold', hex: '#d99a2b', soft: '#f6e4bd' },
  { colour: 'Blue', hex: '#2f6f9f', soft: '#cfe0ee' },
] as const
const COMPUTER_MS = 700
const AUTO_MS = 450

type Kind = { cls: string; seat?: number; star?: boolean }
/** What each grid square is, for drawing the board. */
const KINDS: Kind[][] = Array.from({ length: GRID }, () => Array.from({ length: GRID }, () => ({ cls: 'void' })))
const yardBlocks = [[9, 0], [0, 0], [0, 9], [9, 9]]
yardBlocks.forEach(([r0, c0], seat) => {
  for (let r = r0; r < r0 + 6; r++) for (let c = c0; c < c0 + 6; c++) KINDS[r][c] = { cls: 'yard', seat }
  YARD[seat].forEach(([r, c]) => (KINDS[r][c] = { cls: 'spot', seat }))
})
RING.forEach(([r, c], i) => {
  const start = [0, 1, 2, 3].find((s) => startIndex(s) === i)
  KINDS[r][c] = start !== undefined ? { cls: 'start', seat: start } : { cls: 'track', star: isSafeRing(i) }
})
HOME_COLUMN.forEach((cells, seat) => cells.forEach(([r, c]) => (KINDS[r][c] = { cls: 'lane', seat })))

function Die({ n, spin }: { n: number; spin: number }) {
  return <span key={spin} className="ld-die" data-n={n} aria-hidden="true">{Array.from({ length: n }, (_, i) => <i key={i} />)}</span>
}

export function Ludo({ onFinish, seed }: GameProps) {
  const [match, setMatch] = useState(() => loadMatch(seed))
  const [count, setCount] = useState(2)
  const [computersWanted, setComputersWanted] = useState(1)
  const [confirmRestart, setConfirmRestart] = useState(false)
  const state = match?.state
  const computers = match?.computers ?? 0
  const humans = (state?.seats.length ?? count) - computers
  const isComputer = (slot: number) => slot >= humans
  const name = (slot: number) => (isComputer(slot) ? `Computer ${slot - humans + 1}` : `Player ${slot + 1}`)
  const latest = useRef<{ act: (a: Action) => void }>({ act: () => {} })

  function start() {
    const next = { state: newGame(count, seed ?? String(createRandom()())), actions: [], startedAt: Date.now(), computers: Math.min(computersWanted, count - 1) }
    saveMatch(next)
    setMatch(next)
    setConfirmRestart(false)
  }
  function act(action: Action) {
    if (!match) return
    const next = applyAction(match.state, action)
    if (next === match.state) return
    const updated = { ...match, state: next, actions: [...match.actions, action] }
    saveMatch(updated)
    setMatch(updated)
    if (next.phase === 'done') {
      const won = next.winner! < humans
      onFinish({
        score: (won ? 200 : 0) + homeCount(next, 0) * 25 + next.captures[0] * 10,
        won,
        durationMs: Math.max(0, Date.now() - match.startedAt),
        stats: { players: next.seats.length, computers, rolls: next.rolls, captures: next.captures[0], tokensHome: homeCount(next, 0) },
      })
    }
  }
  useEffect(() => {
    latest.current = { act }
  })

  const moves = state ? legalMoves(state) : []
  const computerTurn = !!state && state.phase !== 'done' && isComputer(state.turn)
  const humanMove = !!state && state.phase === 'move' && !isComputer(state.turn)
  // The computer, and a human with only one possible move, act on a short timer so every step can be followed.
  useEffect(() => {
    if (!state || state.phase === 'done' || confirmRestart) return
    const auto = isComputer(state.turn) || (state.phase === 'move' && moves.length === 1)
    if (!auto) return
    const timer = setTimeout(() => latest.current.act(isComputer(state.turn) ? chooseAction(state) : { type: 'move', token: moves[0] }), isComputer(state.turn) ? COMPUTER_MS : AUTO_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match, confirmRestart])

  const view: State = state ?? newGame(count, '')
  const turnSeat = SEATS[view.seats[view.turn]]
  const statusText = !state
    ? 'Roll a six to bring a token out. First to bring all four home wins.'
    : state.phase === 'done'
      ? `${name(state.winner!)} (${SEATS[state.seats[state.winner!]].colour}) wins${state.winner! < humans ? '!' : '.'}`
      : `${state.dice !== null && state.rolledBy !== null ? `${name(state.rolledBy)} rolled ${state.dice}. ${state.message}`.trim() + ' ' : ''}${state.phase === 'move' ? (humanMove ? 'Choose a token to move.' : `${name(state.turn)} is choosing.`) : `${name(state.turn)} to roll.`}`

  // Tokens that share a square are fanned out a little so each can be seen.
  const placed = view.seats.flatMap((seat, slot) => view.tokens[slot].map((p, token) => ({ slot, seat, token, p, at: cellOf(seat, token, p) })))
  const count_ = (key: string) => placed.filter((t) => `${t.at}` === key).length
  const seen = new Map<string, number>()

  return <div className="ld">
    {!state || state.phase === 'done' || confirmRestart ? <div className="ld-setup">
      <label>Players <select value={count} onChange={(e) => setCount(Number(e.target.value))}>{[2, 3, 4].map((n) => <option key={n} value={n}>{n} players</option>)}</select></label>
      <label>Computers <select value={Math.min(computersWanted, count - 1)} onChange={(e) => setComputersWanted(Number(e.target.value))}>{Array.from({ length: count }, (_, n) => <option key={n} value={n}>{n === 0 ? 'None' : n}</option>)}</select></label>
      <button className="primary-btn" onClick={start}>{confirmRestart ? 'Replace match' : state?.phase === 'done' ? 'Play again' : 'Start match'}</button>
      {confirmRestart ? <button className="secondary-btn" onClick={() => setConfirmRestart(false)}>Keep playing</button> : null}
    </div> : null}
    <div className="ld-bar">
      {state && state.dice !== null ? <Die n={state.dice} spin={state.rolls} /> : <span className="ld-die ld-die-empty" aria-hidden="true" />}
      <p className={`ld-status${state?.phase === 'done' ? (state.winner! < humans ? ' win-message' : ' game-over') : ''}`} role="status" aria-live="polite">{statusText}</p>
      {state && state.phase === 'roll' && !computerTurn ? <button className="primary-btn" onClick={() => act({ type: 'roll' })}>Roll dice</button> : null}
    </div>
    <div className="ld-board" role="group" aria-label="Ludo board" style={{ '--turn': turnSeat.hex } as React.CSSProperties}>
      <div className="ld-grid" aria-hidden="true">
        {KINDS.flatMap((row, r) => row.map((k, c) => <i key={`${r}-${c}`} className={`ld-c ld-${k.cls}`} data-star={k.star ? '' : undefined} style={k.seat !== undefined ? { '--seat': SEATS[k.seat].hex, '--soft': SEATS[k.seat].soft } as React.CSSProperties : undefined} />))}
        <span className="ld-centre" />
      </div>
      <div className="ld-tokens">
        {placed.map((t) => {
          const key = `${t.at}`
          const n = count_(key)
          const i = seen.get(key) ?? 0
          seen.set(key, i + 1)
          const fan = n > 1 && t.p >= 0 && t.p < 56 ? (i - (n - 1) / 2) * 0.32 : 0
          const movable = humanMove && state!.turn === t.slot && moves.includes(t.token)
          const where = t.p === -1 ? 'in the yard' : t.p === 56 ? 'home' : t.p > 50 ? 'in the home lane' : 'on the track'
          return <button key={`${t.slot}-${t.token}`} className="ld-token" data-movable={movable ? 'true' : undefined} disabled={!movable}
            aria-label={`${SEATS[t.seat].colour} token ${t.token + 1}, ${where}${movable ? ', can move' : ''}`}
            style={{ left: `${((t.at[1] + 0.5 + fan) / GRID) * 100}%`, top: `${((t.at[0] + 0.5) / GRID) * 100}%`, '--seat': SEATS[t.seat].hex } as React.CSSProperties}
            onClick={() => act({ type: 'move', token: t.token })}><span /></button>
        })}
      </div>
    </div>
    <ul className="ld-players" aria-label={state?.phase === 'done' ? 'Final result' : 'Players'}>
      {view.seats.map((seat, slot) => <li key={seat} data-active={state && state.phase !== 'done' && slot === view.turn ? 'true' : undefined}>
        <span className="ld-chip" style={{ background: SEATS[seat].hex }} />
        <strong>{name(slot)}</strong><small>{SEATS[seat].colour} · {homeCount(view, slot)}/4 home</small>
      </li>)}
    </ul>
    {state && state.phase !== 'done' && !confirmRestart ? <button className="secondary-btn ld-new" onClick={() => setConfirmRestart(true)}>New match</button> : null}
    <details><summary>How to play</summary>
      <p>Roll a six to bring a token out of its yard onto your start square. Tokens travel clockwise round the board, then turn into your coloured lane and finish in the centre; you need the exact number to get home.</p>
      <p>Landing on another colour’s token sends it back to its yard, except on start squares and star squares, which are safe. A six, a capture or getting a token home gives you another roll, but three sixes in a row lose the turn.</p>
      <p>The first player to bring all four tokens home wins. Choose how many seats the computer plays when you start a match; with no computer players, pass the device between turns.</p>
    </details>
  </div>
}
