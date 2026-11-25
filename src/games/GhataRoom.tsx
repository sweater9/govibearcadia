import { useMemo, useState } from 'react'
import { TokenIcon } from '../components/TokenIcon'
import {
  LAYOUTS, actionDestination, board, homeCount, innerKey, isSafe, keyOf, legalActions, yardCount,
  type Action, type Seat, type Size, type State,
} from './ghata/rules'
import { SEAT_INFO } from './ghata/seats'
import { MIN_PLAYERS } from './ghata/online'
import { TOKENS } from './ghata/tokens'

/** What the Worker sends a Ghata Bara seat. Before the host starts, `lobby` is true and there is no board. */
export type GhataMessage = {
  you: number
  yourSeat: number | null
  playing: boolean
  turn: number | null
  winner: number | null
  computerWon: boolean
  round: number
  wins: number[]
  rematch: boolean[]
  connected: boolean[]
  humanAt: (number | null)[]
  lobby: boolean
  host: number
  seated: number
  board: State | null
}

type Props = { state: GhataMessage | null; reconnecting: boolean; notice: string; send: (message: object) => void }

const SQUARES: Record<Size, Map<string, string>> = { 5: new Map(), 7: new Map() }
for (const size of [5, 7] as const) {
  const l = LAYOUTS[size]
  l.outerCells.forEach(([r, c], i) => SQUARES[size].set(`${r},${c}`, `o${i}`))
  l.interiorCells.forEach(([r, c], i) => SQUARES[size].set(`${r},${c}`, `i${i}`))
  SQUARES[size].set(l.centre.join(','), 'c')
}
const startSeats = (size: Size): Record<string, Seat> => Object.fromEntries(LAYOUTS[size].start.map((i, seat) => [`o${i}`, seat as Seat]))
const ringOf = (key: string, size: Size) => (key === 'c' ? 'home' : key[0] === 'o' ? 'outer' : size === 7 && Number(key.slice(1)) < 16 ? 'middle' : 'inner')
const sumOf = (s: State, chunks: number[]) => chunks.reduce((t, i) => t + s.queue[i], 0)

type Move = { action: Extract<Action, { type: 'move' }>; dest: string; points: number }

/** The whole online Ghata Bara room: the lobby, then the board. The server rolls the dice and plays the computer seats. */
export default function GhataRoom({ state, reconnecting, notice, send }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const [size, setSize] = useState<Size>(7)
  const game = state?.board ?? null
  const here = state ? state.connected.filter(Boolean).length : 0
  const isHost = !!state && state.host === state.you
  const over = !!game && game.phase === 'over'
  const myTurn = !!state && !!game && state.playing && state.turn === state.you
  const name = (seat: number) => SEAT_INFO[seat].name
  const who = (seat: number) => (state?.humanAt[seat] === state?.you ? 'you' : state?.humanAt[seat] === null ? 'computer' : `player ${(state?.humanAt[seat] ?? 0) + 1}`)

  const actions = useMemo(() => (game && myTurn && game.phase === 'move' ? legalActions(game) : []), [game, myTurn])
  const moves = useMemo<Move[]>(
    () => actions.flatMap((a) => {
      if (a.type !== 'move' || !game) return []
      const dest = actionDestination(game, a)
      return dest ? [{ action: a, dest, points: sumOf(game, a.chunks) }] : []
    }),
    [actions, game],
  )
  const releases = actions.filter((a): a is Extract<Action, { type: 'release' }> => a.type === 'release')

  const squareOf = (kind: 'pawn' | 'juga', id: number): string => {
    const g = game!
    if (kind === 'pawn') {
      const p = g.pawns[id]
      return keyOf(p.seat, p.where, p.at, g.size)!
    }
    const j = g.jugas.find((x) => x.id === id)!
    return innerKey(j.seat, j.at, g.size)
  }
  const movableAt = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const m of moves) {
      const piece = `${m.action.kind}:${m.action.id}`
      const sq = squareOf(m.action.kind, m.action.id)
      const list = map.get(sq) ?? []
      if (!list.includes(piece)) list.push(piece)
      map.set(sq, list)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moves])
  const targets = useMemo(() => {
    const map = new Map<string, Move>()
    if (selected) for (const m of moves) if (`${m.action.kind}:${m.action.id}` === selected && !map.has(m.dest)) map.set(m.dest, m)
    return map
  }, [moves, selected])

  const play = (a: Action) => {
    setSelected(null)
    if (a.type === 'release') send({ type: 'move', action: 'release', chunk: a.chunk })
    else if (a.type === 'move') send({ type: 'move', action: 'move', kind: a.kind, id: a.id, chunks: a.chunks })
  }
  const click = (key: string) => {
    if (!myTurn) return
    const target = targets.get(key)
    if (target) return play(target.action)
    const list = movableAt.get(key)
    if (list?.length) setSelected(list[(selected ? list.indexOf(selected) + 1 : 0) % list.length])
    else setSelected(null)
  }

  const headline = reconnecting ? 'Reconnecting…'
    : !state ? 'Connecting…'
    : state.lobby ? (isHost ? (here >= MIN_PLAYERS ? 'Ready when you are' : 'Waiting for a friend…') : 'Waiting for the host…')
    : over ? (state.winner === state.you ? 'You win!' : state.winner !== null ? `Player ${state.winner + 1} wins` : 'The computer wins')
    : !state.playing ? `Watching: ${name(game!.turn)}'s move`
    : myTurn ? (game!.phase === 'roll' ? 'Your roll' : 'Your move')
    : `${name(game!.turn)} (${who(game!.turn)}) is moving`
  const readyCount = state ? state.rematch.filter((r, i) => r && state.connected[i]).length : 0

  const renderBoard = (g: State) => {
    const occupancy = board(g)
    const squares = SQUARES[g.size]
    const START = startSeats(g.size)
    return (
      <div className="gb-board" data-size={g.size} style={{ ['--n' as string]: g.size }} role="group" aria-label={`Ghata Bara board, ${g.size} by ${g.size}`}>
        {Array.from({ length: g.size }, (_, r) => Array.from({ length: g.size }, (_, c) => {
          const key = squares.get(`${r},${c}`)!
          const occ = occupancy.get(key)
          const target = targets.get(key)
          const movable = movableAt.has(key)
          const isSel = !!selected && movableAt.get(key)?.includes(selected)
          const bits = [`Row ${r + 1}, column ${c + 1}`]
          if (isSafe(key, g.size)) bits.push('safe square')
          for (const p of occ?.singles ?? []) bits.push(`${name(p.seat)} pawn`)
          for (const j of occ?.jugas ?? []) bits.push(`${name(j.seat)} Juga`)
          if (target) bits.push(`move here using ${target.points}`)
          else if (movable) bits.push('your piece, can move')
          return (
            <button
              key={key}
              className="gb-sq"
              data-square={key}
              data-safe={isSafe(key, g.size) || undefined}
              data-home={key === 'c' || undefined}
              data-seat={START[key]}
              data-ring={ringOf(key, g.size)}
              data-target={target ? '' : undefined}
              data-movable={movable ? '' : undefined}
              data-selected={isSel || undefined}
              aria-label={bits.join('. ')}
              disabled={!(movable || target)}
              onClick={() => click(key)}
            >
              {key === 'c' ? (
                <span className="gb-homes">
                  {([0, 1, 2, 3] as Seat[]).flatMap((s) => Array.from({ length: homeCount(g, s) }, (_, i) => <i key={`${s}${i}`} data-seat={s} />))}
                </span>
              ) : (
                <>
                  {occ?.singles.map((p) => (
                    <span key={p.id} className="gb-pawn" data-seat={p.seat} data-pinned={p.pinnedBy !== null || undefined} data-token={TOKENS[p.seat].id}><TokenIcon token={p.seat} /></span>
                  ))}
                  {occ?.jugas.map((j) => (
                    <span key={`j${j.id}`} className="gb-juga" data-seat={j.seat} data-holding={j.pinned !== null || undefined}>
                      <i><TokenIcon token={j.seat} /></i>
                      <i><TokenIcon token={j.seat} /></i>
                    </span>
                  ))}
                </>
              )}
              {target ? <b className="gb-badge">{target.points}</b> : null}
            </button>
          )
        }))}
      </div>
    )
  }

  return (
    <div className="gb gb-room">
      <div className="game-toolbar c4-bar">
        <div>
          <small>Status</small>
          <strong className="c4-status" aria-live="polite">{headline}</strong>
        </div>
        {state ? <div><small>Wins</small><strong aria-label="Your wins">{state.wins[state.you]}</strong></div> : null}
      </div>
      {!state ? <p>Connecting…</p>
        : state.lobby ? (
          <section className="wt-lobby" aria-label="Lobby">
            <h3>Players</h3>
            <ul aria-label="Seats">
              {Array.from({ length: 4 }, (_, i) => {
                const taken = i < state.seated
                return <li key={i} data-open={!taken} data-away={taken && !state.connected[i]}>
                  {taken ? `Player ${i + 1}${i === state.you ? ' (you)' : ''}${i === state.host ? ', host' : ''}${state.connected[i] ? '' : ', away'}` : 'Open seat'}
                </li>
              })}
            </ul>
            <p>The computer plays any colour nobody takes.</p>
            {isHost ? (
              <>
                <select aria-label="Board size" value={size} onChange={(e) => setSize(Number(e.target.value) as Size)}>
                  <option value={7}>7×7 board</option>
                  <option value={5}>5×5 board</option>
                </select>
                <button className="primary-btn" disabled={here < MIN_PLAYERS} onClick={() => send({ type: 'start', size })}>Start game</button>
              </>
            ) : <p>Player {state.host + 1} starts the game when everyone is here.</p>}
          </section>
        ) : game ? (
          <>
            {renderBoard(game)}
            <div className="gb-controls">
              <div className="gb-queue" role="group" aria-label="Moves to place">
                {(game.phase === 'move' ? game.queue : game.rolls).map((v, i) => <span key={i} className="gb-chunk">{v}</span>)}
              </div>
              {releases.map((r) => (
                <button key={r.chunk} className="secondary-btn" onClick={() => play(r)}>Release a pawn ({game.queue[r.chunk]})</button>
              ))}
              <button className="primary-btn gb-roll" disabled={!(myTurn && game.phase === 'roll')} onClick={() => send({ type: 'move', action: 'roll' })}>Roll</button>
            </div>
            <ul className="gb-seats" aria-label="Seats">
              {([0, 1, 2, 3] as Seat[]).map((s) => {
                const away = state.humanAt[s] !== null && state.humanAt[s] !== state.you && !state.connected[state.humanAt[s]!]
                return (
                  <li key={s} data-seat={s} data-turn={game.turn === s && !over ? '' : undefined}>
                    <strong><span className="gb-key" data-seat={s}><TokenIcon token={s} /></span> {name(s)}</strong>
                    <small>{who(s) === 'computer' ? 'Computer' : `Player${who(s) === 'you' ? ' (you)' : away ? ' (away)' : ''}`} · {SEAT_INFO[s].side}</small>
                    <small>Yard {yardCount(game, s)} · Home {homeCount(game, s)}/6</small>
                    {away && game.turn === s && !over && state.playing ? (
                      <button className="secondary-btn" onClick={() => send({ type: 'replace', seat: state.humanAt[s] })}>Let the computer play for them</button>
                    ) : null}
                  </li>
                )
              })}
            </ul>
            {over ? (
              <div className="game-over">
                <h3>{headline}</h3>
                {state.playing ? (
                  <>
                    <button className="primary-btn" disabled={state.rematch[state.you]} onClick={() => send({ type: 'rematch' })}>
                      {state.rematch[state.you] ? 'Waiting for the others…' : 'Rematch'}
                    </button>
                    <p>{readyCount} of {here} ready</p>
                  </>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      {notice ? <p role="status">{notice}</p> : null}
    </div>
  )
}
