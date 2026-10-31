import type { Random } from '../../lib/rng'

/**
 * Pure Battleship rules for a two-seat room, shared by single-player (the computer is seat 1) and online play
 * (the Worker is the only authority). 10x10 grid, fleet of 5, one shot per turn, turns alternate.
 *
 * Hidden information: `viewFor(room, seat)` is the ONLY thing a client is ever sent. It contains the viewer's own
 * ships and the results of the viewer's own shots, never the opponent's unrevealed ships (they appear only once
 * sunk, or when the round is over). No React or browser APIs.
 */

export const SIZE = 10
export const FLEET_LENGTHS = [5, 4, 3, 3, 2] as const
export type Seat = 0 | 1
/** Each ship is the list of cell indices (row * 10 + col) it occupies. */
export type Fleet = number[][]
export type Phase = 'placing' | 'battle' | 'over'
export type ShotResult = 'miss' | 'hit' | 'sunk'

export const seatOther = (s: Seat): Seat => (s === 0 ? 1 : 0)
const row = (i: number) => Math.floor(i / SIZE)
const col = (i: number) => i % SIZE

export type Room = {
  phase: Phase
  fleets: [Fleet, Fleet]
  /** Cells each seat has been shot at, in order. */
  received: [number[], number[]]
  ready: [boolean, boolean]
  /** Whose shot it is during battle. */
  turn: Seat
  /** The seat that shoots first this round. It alternates every round. */
  starter: Seat
  winner: Seat | null
  round: number
  wins: [number, number]
  rematch: [boolean, boolean]
}

/** A random legal fleet. Draws from `random`, so the same seed gives the same fleet. */
export function randomFleet(random: Random = Math.random): Fleet {
  const taken = new Set<number>()
  const fleet: Fleet = []
  for (const len of FLEET_LENGTHS) {
    for (;;) {
      const horizontal = random() < 0.5
      const r = Math.floor(random() * SIZE)
      const c = Math.floor(random() * SIZE)
      const cells = Array.from({ length: len }, (_, k) => (horizontal ? r * SIZE + c + k : (r + k) * SIZE + c))
      const fits = horizontal ? c + len <= SIZE : r + len <= SIZE
      if (fits && cells.every((x) => !taken.has(x))) {
        cells.forEach((x) => taken.add(x))
        fleet.push(cells)
        break
      }
    }
  }
  return fleet
}

/** A fleet is valid when it has the right ship lengths, each ship is a straight line, and nothing overlaps. */
export function isFleet(v: unknown): v is Fleet {
  if (!Array.isArray(v) || v.length !== FLEET_LENGTHS.length) return false
  const lengths = v.map((s) => (Array.isArray(s) ? s.length : -1)).sort((a, b) => b - a)
  if (lengths.some((n, i) => n !== FLEET_LENGTHS[i])) return false
  const seen = new Set<number>()
  for (const ship of v as unknown[][]) {
    if (!ship.every((x) => Number.isInteger(x) && (x as number) >= 0 && (x as number) < SIZE * SIZE)) return false
    const cells = ship as number[]
    const sameRow = cells.every((x) => row(x) === row(cells[0]))
    const sameCol = cells.every((x) => col(x) === col(cells[0]))
    if (!sameRow && !sameCol) return false
    const sorted = [...cells].sort((a, b) => a - b)
    const step = sameRow ? 1 : SIZE
    if (sorted.some((x, i) => i > 0 && x - sorted[i - 1] !== step)) return false
    for (const x of cells) {
      if (seen.has(x)) return false
      seen.add(x)
    }
  }
  return true
}

const sunkShips = (fleet: Fleet, received: readonly number[]): Fleet => fleet.filter((ship) => ship.every((c) => received.includes(c)))

export function newRoom(random: Random = Math.random): Room {
  return {
    phase: 'placing',
    fleets: [randomFleet(random), randomFleet(random)],
    received: [[], []],
    ready: [false, false],
    turn: 0,
    starter: 0,
    winner: null,
    round: 1,
    wins: [0, 0],
    rematch: [false, false],
  }
}

export type Failure = 'game-over' | 'not-your-turn' | 'illegal-move' | 'game-not-over' | 'wrong-phase'
export type Outcome = { ok: true; room: Room } | { ok: false; error: Failure }

/** Applies one client message. `random` is only used by "shuffle" and rematches. */
export function act(room: Room, seat: Seat, message: Record<string, unknown>, random: Random = Math.random): Outcome {
  switch (message.type) {
    case 'shuffle': {
      if (room.phase !== 'placing' || room.ready[seat]) return { ok: false, error: 'wrong-phase' }
      const fleets: [Fleet, Fleet] = [...room.fleets]
      fleets[seat] = randomFleet(random)
      return { ok: true, room: { ...room, fleets } }
    }
    case 'ready': {
      if (room.phase !== 'placing') return { ok: false, error: 'wrong-phase' }
      const ready: [boolean, boolean] = [...room.ready]
      ready[seat] = true
      const both = ready[0] && ready[1]
      return { ok: true, room: { ...room, ready, phase: both ? 'battle' : 'placing', turn: room.starter } }
    }
    case 'move': {
      if (room.phase === 'over') return { ok: false, error: 'game-over' }
      if (room.phase !== 'battle') return { ok: false, error: 'wrong-phase' }
      if (room.turn !== seat) return { ok: false, error: 'not-your-turn' }
      const cell = message.cell
      const target = seatOther(seat)
      if (typeof cell !== 'number' || !Number.isInteger(cell) || cell < 0 || cell >= SIZE * SIZE || room.received[target].includes(cell)) return { ok: false, error: 'illegal-move' }
      const received: [number[], number[]] = [[...room.received[0]], [...room.received[1]]]
      received[target].push(cell)
      const done = sunkShips(room.fleets[target], received[target]).length === FLEET_LENGTHS.length
      const wins: [number, number] = [...room.wins]
      if (done) wins[seat]++
      return { ok: true, room: { ...room, received, turn: target, phase: done ? 'over' : 'battle', winner: done ? seat : null, wins } }
    }
    case 'rematch': {
      if (room.phase !== 'over') return { ok: false, error: 'game-not-over' }
      const rematch: [boolean, boolean] = [...room.rematch]
      rematch[seat] = true
      if (!(rematch[0] && rematch[1])) return { ok: true, room: { ...room, rematch } }
      const starter = seatOther(room.starter)
      return { ok: true, room: { ...newRoom(random), starter, turn: starter, round: room.round + 1, wins: room.wins } }
    }
    default:
      return { ok: false, error: 'illegal-move' }
  }
}

export type Shot = { cell: number; result: ShotResult }
export type BoardView = {
  phase: Phase
  /** Your own ships (you may always see these). */
  fleet: Fleet
  /** Cells the opponent has shot at you. */
  incoming: number[]
  /** Your shots, with what each one hit. */
  shots: Shot[]
  /** Opponent ships you have sunk. Revealed because you sank them. */
  sunk: Fleet
  ready: { you: boolean; opp: boolean }
  left: { you: number; opp: number }
  /** Number of shots you have fired. */
  moves: number
  /** The opponent's whole fleet, only once the round is over. */
  reveal: Fleet | null
}
export type View = {
  you: Seat
  yourColour: 1 | 2
  /** The seat to shoot (also set while placing, so "turn === null" always means the round is over). */
  turn: Seat | null
  winner: Seat | null
  draw: false
  round: number
  wins: [number, number]
  rematch: [boolean, boolean]
  board: BoardView
}

export function viewFor(room: Room, seat: Seat): View {
  const opp = seatOther(seat)
  const over = room.phase === 'over'
  const mine = room.received[opp] // my shots land on the opponent
  const shots: Shot[] = mine.map((cell) => {
    const ship = room.fleets[opp].find((s) => s.includes(cell))
    const sunk = ship !== undefined && ship.every((c) => mine.includes(c))
    return { cell, result: ship === undefined ? 'miss' : sunk ? 'sunk' : 'hit' }
  })
  return {
    you: seat,
    yourColour: room.starter === seat ? 1 : 2,
    turn: over ? null : room.phase === 'placing' ? room.starter : room.turn,
    winner: room.winner,
    draw: false,
    round: room.round,
    wins: room.wins,
    rematch: room.rematch,
    board: {
      phase: room.phase,
      fleet: room.fleets[seat],
      incoming: room.received[seat],
      shots,
      sunk: sunkShips(room.fleets[opp], mine),
      ready: { you: room.ready[seat], opp: room.ready[opp] },
      left: { you: FLEET_LENGTHS.length - sunkShips(room.fleets[seat], room.received[seat]).length, opp: FLEET_LENGTHS.length - sunkShips(room.fleets[opp], mine).length },
      moves: mine.length,
      reveal: over ? room.fleets[opp] : null,
    },
  }
}

/** Trusts nothing read back from storage. */
export function parseRoom(value: unknown): Room | null {
  if (typeof value !== 'object' || value === null) return null
  const r = value as Partial<Room>
  const cells = (v: unknown) => Array.isArray(v) && v.every((x) => Number.isInteger(x) && x >= 0 && x < SIZE * SIZE)
  if (r.phase !== 'placing' && r.phase !== 'battle' && r.phase !== 'over') return null
  if (!Array.isArray(r.fleets) || r.fleets.length !== 2 || !isFleet(r.fleets[0]) || !isFleet(r.fleets[1])) return null
  if (!Array.isArray(r.received) || r.received.length !== 2 || !cells(r.received[0]) || !cells(r.received[1])) return null
  if (!Array.isArray(r.ready) || !Array.isArray(r.wins) || !Array.isArray(r.rematch) || typeof r.round !== 'number') return null
  if ((r.turn !== 0 && r.turn !== 1) || (r.starter !== 0 && r.starter !== 1)) return null
  return r as Room
}

/** Knowledge the computer has about the board it is shooting at. */
export function aiShot(view: View, random: Random = Math.random): number {
  const board = view.board
  const state = Array<'unknown' | 'miss' | 'hit' | 'sunk'>(SIZE * SIZE).fill('unknown')
  for (const s of board.shots) state[s.cell] = s.result === 'miss' ? 'miss' : 'hit'
  for (const ship of board.sunk) for (const c of ship) state[c] = 'sunk'
  const unknown = state.flatMap((s, i) => (s === 'unknown' ? [i] : []))
  const pick = <T,>(list: T[]): T => list[Math.floor(random() * list.length)]
  const hits = state.flatMap((s, i) => (s === 'hit' ? [i] : []))
  if (hits.length) {
    const open = (i: number): number[] => {
      const r = row(i)
      const c = col(i)
      return [r > 0 ? i - SIZE : -1, r < SIZE - 1 ? i + SIZE : -1, c > 0 ? i - 1 : -1, c < SIZE - 1 ? i + 1 : -1].filter((x) => x >= 0 && state[x] === 'unknown')
    }
    // Two or more hits in a line: keep going along that line first.
    const along: number[] = []
    for (const h of hits) {
      for (const [d, ok] of [[1, (x: number) => row(x) === row(h)], [SIZE, () => true]] as const) {
        if (hits.includes(h + d) && ok(h + d)) {
          for (const end of [h - d, h + 2 * d]) {
            const fine = end >= 0 && end < SIZE * SIZE && state[end] === 'unknown' && (d === 1 ? row(end) === row(h) : true)
            if (fine) along.push(end)
          }
        }
      }
    }
    if (along.length) return pick(along)
    return pick(hits.flatMap(open))
  }
  const parity = unknown.filter((i) => (row(i) + col(i)) % 2 === 0)
  return pick(parity.length ? parity : unknown)
}

/** A win is worth more the fewer shots it took; a loss is worth nothing. */
export const scoreFor = (won: boolean, shots: number) => (won ? Math.max(300, 1000 - 6 * shots) : 0)
