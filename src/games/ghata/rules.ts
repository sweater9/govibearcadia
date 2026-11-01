// Ghata Bara: pure, deterministic rules. No React, no browser APIs, no randomness (dice values are passed in),
// so a server can reuse this file to validate moves later. Rule numbers (§n) refer to docs/GHATA_BARA.md.

export type Seat = 0 | 1 | 2 | 3
export const SEATS: readonly Seat[] = [0, 1, 2, 3]
export const PAWNS_PER_SEAT = 6
export const MAX_JUGAS = 3

/** The four faces of a long die: 1, 2, 3 and a blank that counts as 6 (§4). */
export const FACES = [1, 2, 3, 6] as const
export const BONUS_TOTALS: readonly number[] = [6, 12] // Chowka and Baara
export const COMBINED_TOTALS = [2, 3, 4, 5, 6, 7, 8, 9, 12] as const

export const OUTER = 16
export const INNER = 8

/** Switches for rules the owner has not specified. Defaults are the choices listed in docs/GHATA_BARA.md. */
export const RULES = {
  /** A captured pawn loses its capture credit and must capture again before entering the inner ring. */
  creditSurvivesCapture: false,
} as const

// ---------------------------------------------------------------------------------------------------------------
// Geometry (§2). Rows and columns are zero-based; row 0 is the top.

/** Outer ring, counterclockwise on screen, starting at the top-centre safe square. */
export const OUTER_CELLS: readonly (readonly [number, number])[] = [
  [0, 2], [0, 1], [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1],
  [4, 2], [4, 3], [4, 4], [3, 4], [2, 4], [1, 4], [0, 4], [0, 3],
]
/** Inner ring, clockwise on screen, starting just inside the top-centre square. */
export const INNER_CELLS: readonly (readonly [number, number])[] = [
  [1, 2], [1, 3], [2, 3], [3, 3], [3, 2], [3, 1], [2, 1], [1, 1],
]
export const CENTRE: readonly [number, number] = [2, 2]

/** Each player's start (a safe square), as an index into OUTER_CELLS: top, left, bottom, right. */
export const START: readonly number[] = [0, 4, 8, 12]
/** Where a pawn enters the inner ring: the inner square just inside its own start. */
export const ENTRY: readonly number[] = [0, 6, 4, 2]

export const SAFE_KEYS: readonly string[] = ['o0', 'o4', 'o8', 'o12', 'c']

export type Where = 'yard' | 'outer' | 'inner' | 'home' | 'juga'

/** `at` is relative to the owner: outer 0..15 steps from their start, inner 0..7 steps from their entry square. */
export type Pawn = { id: number; seat: Seat; where: Where; at: number; credit: boolean; pinnedBy: number | null }
export type Juga = { id: number; seat: Seat; at: number; pawns: [number, number]; pinned: number | null }

export type GameEvent =
  | { type: 'roll'; seat: Seat; total: number }
  | { type: 'bonus-roll'; seat: Seat }
  | { type: 'bust'; seat: Seat }
  | { type: 'release'; seat: Seat }
  | { type: 'capture'; seat: Seat; pawns: number }
  | { type: 'pin'; seat: Seat }
  | { type: 'rescue'; seat: Seat }
  | { type: 'juga'; seat: Seat }
  | { type: 'home'; seat: Seat; pawns: number }
  | { type: 'forfeit'; seat: Seat; chunks: number[] }
  | { type: 'capture-bonus'; seat: Seat }
  | { type: 'win'; seat: Seat }

export type State = {
  pawns: Pawn[]
  jugas: Juga[]
  turn: Seat
  phase: 'roll' | 'move' | 'over'
  /** Totals rolled so far in the current rolling sequence (phase `roll`). */
  rolls: number[]
  /** Whole, indivisible movement chunks still to place (phase `move`). */
  queue: number[]
  /** A capture happened in the current allocation sequence, so one bonus sequence follows (§16). */
  captured: boolean
  /** Which seats have ever entered the inner ring (a Juga forms only once an opponent has). */
  entered: boolean[]
  nextJuga: number
  winner: Seat | null
  /** What the last action did, for feedback. */
  events: GameEvent[]
}

export type Action =
  | { type: 'roll'; dice: readonly [number, number] }
  | { type: 'release'; chunk: number }
  | { type: 'move'; kind: 'pawn' | 'juga'; id: number; chunks: number[] }

export type Result = { ok: true; state: State } | { ok: false; error: string }

export function newGame(): State {
  const pawns: Pawn[] = []
  for (const seat of SEATS) {
    for (let k = 0; k < PAWNS_PER_SEAT; k++) pawns.push({ id: seat * PAWNS_PER_SEAT + k, seat, where: 'yard', at: 0, credit: false, pinnedBy: null })
  }
  return { pawns, jugas: [], turn: 0, phase: 'roll', rolls: [], queue: [], captured: false, entered: [false, false, false, false], nextJuga: 1, winner: null, events: [] }
}

const copy = (s: State): State => JSON.parse(JSON.stringify(s)) as State

// ---------------------------------------------------------------------------------------------------------------
// Squares

export const outerKey = (seat: Seat, at: number) => `o${(START[seat] + at) % OUTER}`
export const innerKey = (seat: Seat, at: number) => `i${(ENTRY[seat] + at) % INNER}`
export const isSafe = (key: string) => SAFE_KEYS.includes(key)

export function keyOf(seat: Seat, where: Where, at: number): string | null {
  if (where === 'outer') return outerKey(seat, at)
  if (where === 'inner' || where === 'juga') return innerKey(seat, at)
  if (where === 'home') return 'c'
  return null
}

export function cellOf(key: string): readonly [number, number] {
  if (key === 'c') return CENTRE
  const n = Number(key.slice(1))
  return key[0] === 'o' ? OUTER_CELLS[n] : INNER_CELLS[n]
}

export const dice = (random: () => number): [number, number] => [FACES[Math.floor(random() * 4)], FACES[Math.floor(random() * 4)]]

type Occupants = { singles: Pawn[]; jugas: Juga[] }

function occupants(s: State, key: string): Occupants {
  return {
    singles: s.pawns.filter((p) => (p.where === 'outer' || p.where === 'inner') && keyOf(p.seat, p.where, p.at) === key),
    jugas: s.jugas.filter((j) => innerKey(j.seat, j.at) === key),
  }
}

/** Who stands where, for drawing the board. */
export function board(s: State): Map<string, Occupants> {
  const map = new Map<string, Occupants>()
  const slot = (key: string) => {
    let o = map.get(key)
    if (!o) map.set(key, (o = { singles: [], jugas: [] }))
    return o
  }
  for (const p of s.pawns) {
    if (p.where === 'outer' || p.where === 'inner') slot(keyOf(p.seat, p.where, p.at)!).singles.push(p)
    else if (p.where === 'home') slot('c').singles.push(p)
  }
  for (const j of s.jugas) slot(innerKey(j.seat, j.at)).jugas.push(j)
  return map
}

// ---------------------------------------------------------------------------------------------------------------
// Movement planning (does not change the state)

type Place = { where: 'outer' | 'inner' | 'home'; at: number }

function nextStep(where: 'outer' | 'inner', at: number, credit: boolean): Place {
  if (where === 'outer') {
    if (at + 1 < OUTER) return { where: 'outer', at: at + 1 }
    return credit ? { where: 'inner', at: 0 } : { where: 'outer', at: 0 } // §8: no credit, keep circulating
  }
  return at + 1 < INNER ? { where: 'inner', at: at + 1 } : { where: 'home', at: 0 }
}

type PawnPlan = { end: Place; path: string[]; capture: number[] }

/** An individual pawn moving `n` squares as one movement (§6, §7, §11, §17). */
export function planPawn(s: State, p: Pawn, n: number): PawnPlan | null {
  if ((p.where !== 'outer' && p.where !== 'inner') || p.pinnedBy !== null || n <= 0) return null
  let place: Place = { where: p.where, at: p.at }
  const path: string[] = []
  for (let i = 0; i < n; i++) {
    if (place.where === 'home') return null // exact count only
    place = nextStep(place.where, place.at, p.credit)
    path.push(place.where === 'home' ? 'c' : keyOf(p.seat, place.where, place.at)!)
  }
  const dest = path[path.length - 1]
  for (const key of path) {
    if (isSafe(key)) continue // safe squares override blockades
    const here = occupants(s, key).jugas
    if (here.some((j) => j.seat !== p.seat)) return null // an opposing Juga blocks landing and passing
    if (key === dest && here.length) return null // own Juga: may pass over, may not land
  }
  let capture: number[] = []
  if (dest !== 'c') {
    const here = occupants(s, dest)
    if (here.singles.filter((x) => x.seat === p.seat && x.id !== p.id).length >= 2) return null // at most two friendly pawns
    if (!isSafe(dest)) capture = here.singles.filter((x) => x.seat !== p.seat).map((x) => x.id)
  }
  return { end: place, path, capture }
}

type JugaPlan = { home: boolean; to: number; captureJugas: number[]; pin: number | null }

/** A Juga moving on `n` movement points, i.e. n / 2 squares (§10, §12 to §15). */
export function planJuga(s: State, j: Juga, n: number): JugaPlan | null {
  if (n <= 0 || n % 2 !== 0) return null
  const to = j.at + n / 2
  if (to > INNER) return null
  if (to === INNER) return { home: true, to, captureJugas: [], pin: null }
  const here = occupants(s, innerKey(j.seat, to))
  if (here.jugas.some((x) => x.seat === j.seat && x.id !== j.id)) return null // friendly Jugas keep to different squares
  const enemy = here.jugas.filter((x) => x.seat !== j.seat)
  if (enemy.length) return { home: false, to, captureJugas: enemy.map((x) => x.id), pin: null }
  if (here.singles.some((x) => x.seat === j.seat)) return null
  if (here.singles.length > 1) return null
  return { home: false, to, captureJugas: [], pin: here.singles.length === 1 ? here.singles[0].id : null }
}

const sum = (queue: number[], idx: number[]) => idx.reduce((t, i) => t + queue[i], 0)

function subsets(count: number): number[][] {
  const out: number[][] = []
  for (let mask = 1; mask < 1 << count; mask++) {
    const idx: number[] = []
    for (let i = 0; i < count; i++) if (mask & (1 << i)) idx.push(i)
    out.push(idx)
  }
  return out
}

function canRelease(s: State): boolean {
  const seat = s.turn
  if (!s.pawns.some((p) => p.seat === seat && p.where === 'yard')) return false
  return occupants(s, outerKey(seat, 0)).singles.filter((x) => x.seat === seat).length < 2
}

/** Every legal action in the move phase. Passing is never offered: a chunk with a legal use cannot be discarded (§6). */
export function legalActions(s: State): Action[] {
  if (s.phase !== 'move') return []
  const out: Action[] = []
  const seen = new Set<string>()
  const add = (a: Action, key: string) => {
    if (seen.has(key)) return
    seen.add(key)
    out.push(a)
  }
  if (canRelease(s)) {
    s.queue.forEach((v, i) => {
      if (BONUS_TOTALS.includes(v)) add({ type: 'release', chunk: i }, `r${v}`)
    })
  }
  for (const idx of subsets(s.queue.length)) {
    const n = sum(s.queue, idx)
    const values = idx.map((i) => s.queue[i]).sort((a, b) => a - b).join(',')
    for (const p of s.pawns) {
      if (p.seat !== s.turn) continue
      const plan = planPawn(s, p, n)
      if (plan) add({ type: 'move', kind: 'pawn', id: p.id, chunks: idx }, `p${p.id}:${values}`)
    }
    for (const j of s.jugas) {
      if (j.seat !== s.turn) continue
      if (planJuga(s, j, n)) add({ type: 'move', kind: 'juga', id: j.id, chunks: idx }, `j${j.id}:${values}`)
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Executing

const pawnById = (s: State, id: number) => s.pawns[id]

function sendHome(s: State, id: number) {
  const p = pawnById(s, id)
  p.where = 'yard'
  p.at = 0
  p.pinnedBy = null
  if (!RULES.creditSurvivesCapture) p.credit = false
}

function nextTurn(s: State) {
  s.turn = ((s.turn + 1) % 4) as Seat
  s.phase = 'roll'
  s.rolls = []
  s.queue = []
  s.captured = false
}

function checkWin(s: State) {
  if (s.winner !== null) return
  for (const seat of SEATS) {
    if (s.pawns.filter((p) => p.seat === seat).every((p) => p.where === 'home')) {
      s.winner = seat
      s.phase = 'over'
      s.queue = []
      s.rolls = []
      s.captured = false // pending bonuses are cancelled (§18)
      s.events.push({ type: 'win', seat })
      return
    }
  }
}

/** Two same-player pawns sharing an inner square become a Juga once an opponent has entered the inner ring (§9). */
function formJugas(s: State) {
  for (const seat of SEATS) {
    if (!s.entered.some((e, other) => e && other !== seat)) continue
    for (let at = 0; at < INNER; at++) {
      const key = innerKey(seat, at)
      const here = occupants(s, key)
      const mine = here.singles.filter((x) => x.seat === seat && x.pinnedBy === null)
      if (mine.length !== 2 || here.jugas.length) continue
      const juga: Juga = { id: s.nextJuga++, seat, at, pawns: [mine[0].id, mine[1].id], pinned: null }
      for (const p of mine) {
        p.where = 'juga'
        p.at = at
      }
      s.jugas.push(juga)
      s.events.push({ type: 'juga', seat })
    }
  }
}

function endSequence(s: State) {
  s.queue = []
  if (s.winner !== null) return
  if (s.captured) {
    s.captured = false
    s.phase = 'roll'
    s.rolls = []
    s.events.push({ type: 'capture-bonus', seat: s.turn })
  } else nextTurn(s)
}

/** After any change: end the sequence when nothing is left or nothing can legally be used. */
function settle(s: State) {
  checkWin(s)
  if (s.phase !== 'move') return
  if (s.queue.length === 0) return endSequence(s)
  if (legalActions(s).length === 0) {
    s.events.push({ type: 'forfeit', seat: s.turn, chunks: [...s.queue] })
    endSequence(s)
  }
}

const fail = (error: string): Result => ({ ok: false, error })

function removeChunks(s: State, idx: number[]) {
  const drop = new Set(idx)
  s.queue = s.queue.filter((_, i) => !drop.has(i))
}

export function apply(prev: State, action: Action): Result {
  if (prev.phase === 'over') return fail('game-over')
  const s = copy(prev)
  s.events = []

  if (action.type === 'roll') {
    if (s.phase !== 'roll') return fail('not-rolling')
    const [a, b] = action.dice
    if (!FACES.includes(a as 1) || !FACES.includes(b as 1)) return fail('bad-dice')
    const total = a + b
    s.rolls.push(total)
    s.events.push({ type: 'roll', seat: s.turn, total })
    if (BONUS_TOTALS.includes(total)) {
      if (s.rolls.length >= 3) {
        // Three-strike bust (§5): the unexecuted sequence is cancelled, earlier movements stand.
        s.events.push({ type: 'bust', seat: s.turn })
        nextTurn(s)
      } else s.events.push({ type: 'bonus-roll', seat: s.turn })
      return { ok: true, state: s }
    }
    s.queue = [...s.rolls]
    s.rolls = []
    s.phase = 'move'
    settle(s)
    return { ok: true, state: s }
  }

  if (s.phase !== 'move') return fail('not-moving')
  const idx = action.type === 'release' ? [action.chunk] : [...action.chunks].sort((x, y) => x - y)
  if (!idx.length || new Set(idx).size !== idx.length || idx.some((i) => !Number.isInteger(i) || i < 0 || i >= s.queue.length)) return fail('bad-chunks')

  if (action.type === 'release') {
    if (!BONUS_TOTALS.includes(s.queue[action.chunk])) return fail('cannot-release')
    if (!canRelease(s)) return fail('cannot-release')
    const pawn = s.pawns.find((p) => p.seat === s.turn && p.where === 'yard')!
    pawn.where = 'outer'
    pawn.at = 0
    removeChunks(s, idx)
    s.events.push({ type: 'release', seat: s.turn })
    settle(s)
    return { ok: true, state: s }
  }

  const n = sum(s.queue, idx)
  const seat = s.turn
  let captures = 0
  let finished = 0

  if (action.kind === 'pawn') {
    const p = pawnById(s, action.id)
    if (!p || p.seat !== seat) return fail('not-your-pawn')
    const plan = planPawn(s, p, n)
    if (!plan) return fail('illegal-move')
    if (plan.path.some((k) => k[0] === 'i')) s.entered[seat] = true
    for (const id of plan.capture) {
      sendHome(s, id)
      captures++
    }
    if (plan.capture.length) p.credit = true
    p.where = plan.end.where
    p.at = plan.end.at
    if (p.where === 'home') finished = 1
  } else {
    const j = s.jugas.find((x) => x.id === action.id)
    if (!j || j.seat !== seat) return fail('not-your-juga')
    const plan = planJuga(s, j, n)
    if (!plan) return fail('illegal-move')
    const [pa, pb] = [pawnById(s, j.pawns[0]), pawnById(s, j.pawns[1])]
    if (j.pinned !== null) {
      // Delayed capture: leaving the square captures the pawn underneath, even if the Juga ends in Home (§12).
      sendHome(s, j.pinned)
      j.pinned = null
      captures++
      pa.credit = pb.credit = true
    }
    if (plan.home) {
      s.jugas = s.jugas.filter((x) => x.id !== j.id)
      pa.where = pb.where = 'home'
      finished = 2
    } else {
      j.at = plan.to
      pa.at = pb.at = plan.to
      for (const id of plan.captureJugas) {
        const dead = s.jugas.find((x) => x.id === id)!
        for (const pid of dead.pawns) sendHome(s, pid)
        captures += 2
        if (dead.pinned !== null) {
          pawnById(s, dead.pinned).pinnedBy = null // rescued; the rescuer does not repin it (§12)
          s.events.push({ type: 'rescue', seat })
        }
        s.jugas = s.jugas.filter((x) => x.id !== id)
        pa.credit = pb.credit = true
      }
      if (plan.pin !== null) {
        pawnById(s, plan.pin).pinnedBy = j.id
        j.pinned = plan.pin
        s.events.push({ type: 'pin', seat })
      }
    }
  }

  removeChunks(s, idx)
  if (captures) {
    s.captured = true // one bonus per allocation sequence, however many pawns fell (§14, §16)
    s.events.push({ type: 'capture', seat, pawns: captures })
  }
  if (finished) s.events.push({ type: 'home', seat, pawns: finished })
  formJugas(s)
  settle(s)
  return { ok: true, state: s }
}

// ---------------------------------------------------------------------------------------------------------------
// Helpers for the interface, bots and tests

/** The square a move would end on (the centre for Home), or null if it is not a move. */
export function actionDestination(s: State, a: Action): string | null {
  if (a.type !== 'move') return null
  const n = a.chunks.reduce((t, i) => t + s.queue[i], 0)
  if (a.kind === 'pawn') return planPawn(s, s.pawns[a.id], n)?.path.at(-1) ?? null
  const j = s.jugas.find((x) => x.id === a.id)
  const plan = j && planJuga(s, j, n)
  if (!plan || !j) return null
  return plan.home ? 'c' : innerKey(j.seat, plan.to)
}

export const homeCount = (s: State, seat: Seat) => s.pawns.filter((p) => p.seat === seat && p.where === 'home').length
export const yardCount = (s: State, seat: Seat) => s.pawns.filter((p) => p.seat === seat && p.where === 'yard').length

/** Rough progress of a seat, for bots. */
export function progress(s: State, seat: Seat): number {
  let total = 0
  for (const p of s.pawns) {
    if (p.seat !== seat) continue
    if (p.where === 'outer') total += 1 + p.at
    else if (p.where === 'inner' || p.where === 'juga') total += 17 + p.at
    else if (p.where === 'home') total += 30
  }
  return total
}

/** Things that must always be true; used by tests and the random-play check. Returns what is wrong. */
export function invariantErrors(s: State): string[] {
  const errors: string[] = []
  if (s.pawns.length !== 24) errors.push('pawn count')
  const claimed = new Set<number>()
  for (const j of s.jugas) {
    for (const id of j.pawns) {
      if (claimed.has(id)) errors.push(`pawn ${id} in two Jugas`)
      claimed.add(id)
      const p = s.pawns[id]
      if (p.where !== 'juga' || p.at !== j.at || p.seat !== j.seat) errors.push(`Juga ${j.id} disagrees with pawn ${id}`)
    }
    if (j.pinned !== null && s.pawns[j.pinned].pinnedBy !== j.id) errors.push(`pin mismatch on Juga ${j.id}`)
  }
  for (const p of s.pawns) {
    if (p.where === 'juga' && !claimed.has(p.id)) errors.push(`pawn ${p.id} marked in a Juga but none holds it`)
    if (p.pinnedBy !== null && s.jugas.find((j) => j.id === p.pinnedBy)?.pinned !== p.id) errors.push(`pawn ${p.id} pinned by nothing`)
  }
  for (const seat of SEATS) if (s.jugas.filter((j) => j.seat === seat).length > MAX_JUGAS) errors.push('too many Jugas')
  const keys = new Set<string>()
  for (const p of s.pawns) {
    const k = keyOf(p.seat, p.where, p.at)
    if (k) keys.add(k)
  }
  for (const k of keys) {
    if (k === 'c') continue
    const here = occupants(s, k)
    for (const seat of SEATS) {
      if (here.singles.filter((x) => x.seat === seat).length > 2) errors.push(`more than two pawns of ${seat} on ${k}`)
      if (here.jugas.filter((x) => x.seat === seat).length > 1) errors.push(`two Jugas of ${seat} on ${k}`)
    }
    if (!isSafe(k) && here.jugas.length > 1) errors.push(`two Jugas on ${k}`)
    const seatsHere = new Set(here.singles.map((x) => x.seat))
    if (!isSafe(k) && seatsHere.size > 1 && !here.jugas.length) errors.push(`opposing pawns share unsafe ${k}`)
  }
  return errors
}
