import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { randomSeed } from '../lib/challenge'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { chooseAction } from './ghata/bot'
import {
  FACES, LAYOUTS, actionDestination, apply, board, dice as rollDice, homeCount, innerKey, isSafe, keyOf, legalActions, newGame, yardCount,
  type Action, type GameEvent, type Seat, type Size, type State,
} from './ghata/rules'
import { clearSaved, loadSaved, save } from './ghata/save'
import { HUMAN_SEATS, SEAT_INFO } from './ghata/seats'

/** Pause before the computer acts, and how long the dice tumble, so every step can be followed. */
const BOT_MS = 380
const ROLL_MS = 480

/** `row,column` to square id, for each board. */
const SQUARES: Record<Size, Map<string, string>> = { 5: new Map(), 7: new Map() }
for (const size of [5, 7] as const) {
  const l = LAYOUTS[size]
  l.outerCells.forEach(([r, c], i) => SQUARES[size].set(`${r},${c}`, `o${i}`))
  l.interiorCells.forEach(([r, c], i) => SQUARES[size].set(`${r},${c}`, `i${i}`))
  SQUARES[size].set(l.centre.join(','), 'c')
}

const startSeats = (size: Size): Record<string, Seat> => Object.fromEntries(LAYOUTS[size].start.map((i, seat) => [`o${i}`, seat as Seat]))

const ringOf = (key: string, size: Size) => (key === 'c' ? 'home' : key[0] === 'o' ? 'outer' : size === 7 && Number(key.slice(1)) < 16 ? 'middle' : 'inner')

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function describe(events: GameEvent[]): string {
  const name = (s: Seat) => SEAT_INFO[s].name
  const parts = events.map((e) => {
    switch (e.type) {
      case 'roll': return `${name(e.seat)} rolled ${e.total === 6 ? 'Chowka (6)' : e.total === 12 ? 'Baara (12)' : e.total}`
      case 'bonus-roll': return 'roll again'
      case 'bust': return `three in a row: ${name(e.seat)} busts and the sequence is lost`
      case 'release': return `${name(e.seat)} released a pawn`
      case 'capture': return `${name(e.seat)} captured ${plural(e.pawns, 'pawn')}`
      case 'pin': return `${name(e.seat)} pinned a pawn`
      case 'rescue': return 'the pinned pawn is free'
      case 'juga': return `${name(e.seat)} formed a Juga`
      case 'home': return `${plural(e.pawns, 'pawn')} home for ${name(e.seat)}`
      case 'forfeit': return `no legal use for ${e.chunks.join(', ')}`
      case 'capture-bonus': return `${name(e.seat)} earned a capture bonus roll`
      case 'win': return `${name(e.seat)} wins`
    }
  })
  return parts.length ? `${parts.join('; ')}.` : ''
}

const sumOf = (s: State, chunks: number[]) => chunks.reduce((t, i) => t + s.queue[i], 0)

type Move = { action: Extract<Action, { type: 'move' }>; dest: string; points: number }

export function GhataBara({ onFinish, seed }: GameProps) {
  const saved = useMemo(() => (seed === undefined ? loadSaved() : null), [seed])
  const [humans, setHumans] = useState(saved?.humans ?? 1)
  const [game, setGame] = useState<State>(() => saved?.state ?? newGame(7))
  const [matchSeed, setMatchSeed] = useState(() => seed ?? saved?.seed ?? randomSeed())
  const [selected, setSelected] = useState<string | null>(null)
  const [rolling, setRolling] = useState(false)
  const [faces, setFaces] = useState<[number, number] | null>(null)
  const [handoff, setHandoff] = useState<Seat | null>(null)
  const [note, setNote] = useState(saved ? 'Welcome back: your saved game was restored.' : '')
  const draws = useRef(saved?.draws ?? 0)
  const reported = useRef(false)
  const startedAt = useRef(Date.now())
  const rollButton = useRef<HTMLButtonElement>(null)

  const random = useMemo(() => {
    const r = createRandom(matchSeed)
    for (let i = 0; i < draws.current; i++) r()
    return () => {
      draws.current++
      return r()
    }
  }, [matchSeed])

  const over = game.phase === 'over'
  const seats = HUMAN_SEATS[humans]
  const myTurn = !over && seats.includes(game.turn)

  // A run is reported once, from the handler or timer that ends it, never from a state updater.
  const commit = useCallback(
    (next: State, action?: Action) => {
      setGame(next)
      setSelected(null)
      if (action?.type === 'roll') setFaces([action.dice[0], action.dice[1]])
      setNote(describe(next.events))
      if (humans > 1 && next.phase === 'roll' && next.rolls.length === 0 && next.turn !== game.turn && seats.includes(next.turn)) setHandoff(next.turn)
      if (next.phase === 'over') {
        clearSaved()
        if (!reported.current) {
          reported.current = true
          const winner = next.winner!
          const won = seats.includes(winner)
          onFinish({
            score: homeCount(next, 0) * 100 + (won ? 400 : 0),
            durationMs: Date.now() - startedAt.current,
            won,
            stats: { players: humans, winner, pawnsHome: homeCount(next, 0) },
          })
        }
      } else if (seed === undefined) save({ v: 1, seed: matchSeed, draws: draws.current, humans, state: next })
    },
    [onFinish, seats, humans, seed, matchSeed, game.turn],
  )

  const play = useCallback(
    (action: Action) => {
      const result = apply(game, action)
      if (result.ok) commit(result.state, action)
    },
    [game, commit],
  )

  // The computer's turns.
  useEffect(() => {
    if (over || myTurn || rolling) return
    const timer = setTimeout(() => play(chooseAction(game, random)), BOT_MS)
    return () => clearTimeout(timer)
  }, [over, myTurn, rolling, game, random, play])

  // Rolling by hand: the dice tumble for a moment, then the roll is drawn.
  useEffect(() => {
    if (!rolling) return
    let t = 0
    const tumble = setInterval(() => setFaces([FACES[t++ % 4], FACES[(t + 1) % 4]]), 90)
    const done = setTimeout(() => {
      setRolling(false)
      play({ type: 'roll', dice: rollDice(random) })
    }, ROLL_MS)
    return () => {
      clearInterval(tumble)
      clearTimeout(done)
    }
  }, [rolling, random, play])

  const canRoll = myTurn && game.phase === 'roll' && !rolling && handoff === null
  const roll = useCallback(() => {
    if (canRoll) setRolling(true)
  }, [canRoll])

  useEffect(() => {
    if (canRoll) rollButton.current?.focus({ preventScroll: true })
  }, [canRoll, game.turn])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null)
      else if (e.key.toLowerCase() === 'r' && !(e.target instanceof HTMLSelectElement) && !e.ctrlKey && !e.metaKey) roll()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [roll])

  // What the person to move may do.
  const actions = useMemo(() => (myTurn && game.phase === 'move' ? legalActions(game) : []), [game, myTurn])
  const moves = useMemo<Move[]>(
    () =>
      actions.flatMap((a) => {
        if (a.type !== 'move') return []
        const dest = actionDestination(game, a)
        return dest ? [{ action: a, dest, points: sumOf(game, a.chunks) }] : []
      }),
    [actions, game],
  )
  const releases = actions.filter((a): a is Extract<Action, { type: 'release' }> => a.type === 'release')

  const pieceSquare = (kind: 'pawn' | 'juga', id: number) => {
    if (kind === 'pawn') {
      const p = game.pawns[id]
      return keyOf(p.seat, p.where, p.at, game.size)!
    }
    const j = game.jugas.find((x) => x.id === id)!
    return innerKey(j.seat, j.at, game.size)
  }
  const movableAt = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const m of moves) {
      const piece = `${m.action.kind}:${m.action.id}`
      const sq = pieceSquare(m.action.kind, m.action.id)
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

  const click = (key: string) => {
    if (!myTurn) return
    const target = targets.get(key)
    if (target) return play(target.action)
    const here = movableAt.get(key)
    if (here?.length) setSelected(here[(selected ? here.indexOf(selected) + 1 : 0) % here.length])
    else setSelected(null)
  }

  const newMatch = (n: number, size: Size = game.size) => {
    clearSaved()
    draws.current = 0
    reported.current = false
    startedAt.current = Date.now()
    setHumans(n)
    setMatchSeed(seed ?? randomSeed())
    setGame(newGame(size))
    setSelected(null)
    setRolling(false)
    setFaces(null)
    setNote('')
    setHandoff(null)
  }

  const occupancy = board(game)
  const size = game.size
  const START_SEAT = startSeats(size)
  const squares = SQUARES[size]
  const label = (r: number, c: number, key: string) => {
    const occ = occupancy.get(key)
    const bits = [`Row ${r + 1}, column ${c + 1}`]
    if (isSafe(key, size)) bits.push(key === 'c' ? 'Home' : START_SEAT[key] !== undefined ? `safe square, ${SEAT_INFO[START_SEAT[key]].name}'s start` : 'safe square')
    if (key === 'c') {
      for (const s of [0, 1, 2, 3] as Seat[]) if (homeCount(game, s)) bits.push(`${SEAT_INFO[s].name}: ${plural(homeCount(game, s), 'pawn')} home`)
    } else {
      for (const p of occ?.singles ?? []) bits.push(`${SEAT_INFO[p.seat].name} pawn${p.pinnedBy !== null ? ', pinned' : ''}`)
      for (const j of occ?.jugas ?? []) bits.push(`${SEAT_INFO[j.seat].name} Juga${j.pinned !== null ? ', holding a pinned pawn' : ''}`)
    }
    const t = targets.get(key)
    if (t) bits.push(`move here using ${t.points}`)
    else if (movableAt.has(key)) bits.push('your piece, can move')
    return bits.join('. ')
  }

  const status = over
    ? `${SEAT_INFO[game.winner!].name} wins!`
    : game.phase === 'roll'
      ? `${SEAT_INFO[game.turn].name}: ${game.rolls.length ? `rolled ${game.rolls.join(', ')}, roll again` : myTurn ? 'your roll' : 'rolling…'}`
      : `${SEAT_INFO[game.turn].name}: ${myTurn ? 'move with' : 'moving'} ${game.queue.join(' · ')}`

  return (
    <div className="gb">
      <div className="game-toolbar gb-bar">
        <div className="gb-roller">
          <div className="gb-dice" aria-hidden={!faces}>
            {[0, 1].map((i) => (
              <span key={i} className="gb-die" data-rolling={rolling || undefined} data-blank={faces?.[i] === 6 || undefined} data-face={faces?.[i]}>
                {faces ? (faces[i] === 6 ? '' : faces[i]) : ''}
                {faces && faces[i] !== 6 ? Array.from({ length: faces[i] }, (_, k) => <i key={k} />) : null}
              </span>
            ))}
          </div>
          <button ref={rollButton} className="primary-btn gb-roll" disabled={!canRoll} onClick={roll}>
            {rolling ? 'Rolling…' : 'Roll'}
          </button>
          <div className="gb-queue" aria-label="Moves to place">
            {(game.phase === 'move' ? game.queue : game.rolls).map((v, i) => (
              <span key={i} className="gb-chunk">{v}</span>
            ))}
          </div>
          {releases.map((r) => (
            <button key={r.chunk} className="secondary-btn" onClick={() => play(r)}>
              Release a pawn ({game.queue[r.chunk]})
            </button>
          ))}
        </div>
        <div className="gb-settings">
        <select aria-label="Board size" value={game.size} onChange={(e) => newMatch(humans, Number(e.target.value) as Size)}>
          <option value={7}>7×7 board</option>
          <option value={5}>5×5 board</option>
        </select>
        <select aria-label="Players" value={humans} onChange={(e) => newMatch(Number(e.target.value))}>
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>{n === 1 ? '1 player' : `${n} players`}</option>
          ))}
        </select>
        <button className="icon-btn" aria-label="New game" onClick={() => newMatch(humans)}>
          <RotateCcw size={16} />
        </button>
        </div>
      </div>

      <div className="gb-board" data-size={size} style={{ ['--n' as string]: size }} role="group" aria-label={`Ghata Bara board, ${size} by ${size}`}>
        {Array.from({ length: size }, (_, r) =>
          Array.from({ length: size }, (_, c) => {
            const key = squares.get(`${r},${c}`)!
            const occ = occupancy.get(key)
            const target = targets.get(key)
            const movable = movableAt.has(key)
            const isSel = !!selected && movableAt.get(key)?.includes(selected)
            return (
              <button
                key={key}
                className="gb-sq"
                data-square={key}
                data-safe={isSafe(key, size) || undefined}
                data-home={key === 'c' || undefined}
                data-seat={START_SEAT[key]}
                data-ring={ringOf(key, size)}
                data-target={target ? '' : undefined}
                data-movable={movable ? '' : undefined}
                data-selected={isSel || undefined}
                aria-label={label(r, c, key)}
                disabled={!(movable || target)}
                onClick={() => click(key)}
              >
                {key === 'c' ? (
                  <span className="gb-homes">
                    {([0, 1, 2, 3] as Seat[]).flatMap((s) => Array.from({ length: homeCount(game, s) }, (_, i) => <i key={`${s}${i}`} data-seat={s} />))}
                  </span>
                ) : (
                  <>
                    {occ?.singles.map((p) => (
                      <span key={p.id} className="gb-pawn" data-seat={p.seat} data-pinned={p.pinnedBy !== null || undefined}>{SEAT_INFO[p.seat].glyph}</span>
                    ))}
                    {occ?.jugas.map((j) => (
                      <span key={`j${j.id}`} className="gb-juga" data-seat={j.seat} data-holding={j.pinned !== null || undefined}>
                        <i />
                        <i />
                      </span>
                    ))}
                  </>
                )}
                {target ? <b className="gb-badge">{target.points}</b> : null}
              </button>
            )
          }),
        )}
      </div>

      {handoff !== null ? (
        <div className="gb-handoff" role="dialog" aria-label="Pass the device">
          <p>
            Pass the device to <strong style={{ color: SEAT_INFO[handoff].color }}>{SEAT_INFO[handoff].name}</strong>
          </p>
          <button className="primary-btn" autoFocus onClick={() => setHandoff(null)}>
            {SEAT_INFO[handoff].name} is ready
          </button>
        </div>
      ) : null}
      <p className="gb-status" role="status" data-seat={over ? game.winner! : game.turn}>
        <strong>{status}</strong> {note}
      </p>

      <ul className="gb-seats" aria-label="Seats">
        {([0, 1, 2, 3] as Seat[]).map((s) => (
          <li key={s} data-seat={s} data-turn={game.turn === s && !over ? '' : undefined}>
            <strong>
              <span className="gb-key" data-seat={s}>{SEAT_INFO[s].glyph}</span> {SEAT_INFO[s].name}
            </strong>
            <small>
              {seats.includes(s) ? 'Player' : 'Computer'} · {SEAT_INFO[s].side}
            </small>
            <span className="gb-yard" aria-hidden="true">
              {Array.from({ length: 6 }, (_, i) => (
                <i key={i} data-filled={i < yardCount(game, s) || undefined} />
              ))}
            </span>
            <small>
              Yard {yardCount(game, s)} · Home {homeCount(game, s)}/6
              {game.jugas.some((j) => j.seat === s) ? ` · Jugas ${game.jugas.filter((j) => j.seat === s).length}` : ''}
            </small>
          </li>
        ))}
      </ul>
    </div>
  )
}
