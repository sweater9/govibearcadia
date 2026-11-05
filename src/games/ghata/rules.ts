// Ghata Bara: pure, deterministic rules. No React, no browser APIs, no randomness (dice values are passed in),
// so a server can reuse this file to validate moves later. Rule numbers (§n) refer to docs/GHATA_BARA.md.

export type Seat = 0 | 1 | 2 | 3
export const SEATS: readonly Seat[] = [0, 1, 2, 3]
export const PAWNS_PER_SEAT = 6
export const MAX_JUGAS = 3

/** The four faces of a long die: 1, 2, 3 and a blank (stored as 6, never added as 6; see rollTotal). */
export const FACES = [1, 2, 3, 6] as const
export const BLANK = 6
export const BONUS_TOTALS: readonly number[] = [6, 12] // Chowka and Baara
export const COMBINED_TOTALS = [1, 2, 3, 4, 5, 6, 12] as const

/** A blank counts 0 beside a numbered face; two blanks make 12 (Baara). Results: 1 to 6, or 12. */
export const rollTotal = (a: number, b: number): number => (a === BLANK && b === BLANK ? 12 : (a === BLANK ? 0 : a) + (b === BLANK ? 0 : b))

export const OUTER = 16
export const INNER = 8

/** Switches for rules the owner has not specified. Defaults are the choices listed in docs/GHATA_BARA.md. */
export const RULES = {
  /** Capture credit belongs to the player: one capture lets all their pawns turn inward, and being captured never takes it away. */
  creditSurvivesCapture: true,
} as const

export type Size = 5 | 7
type Cell = readonly [number, number]

/** Everything that differs between boards. Square ids: `o<n>` outer (counterclockwise from the top centre), `i<n>` interior, `c` Home. */
export type Layout = {
  size: Size
  outerLen: number
  /** Steps along a seat's interior path (the squares it walks after leaving the outer ring), before Home. */
  interiorLen: number
  /** The outer step (counted from the seat's start square) after which a pawn with capture credit leaves the outer ring. */
  turnAt: number
  outerCells: readonly Cell[]
  /** Interior squares by id, e.g. `i3`. */
  interiorCells: readonly Cell[]
  centre: Cell
  /** Index in `outerCells` of each seat's start square: top, left, bottom, right. */
  start: readonly number[]
  safe: readonly string[]
  /** The square id a seat stands on after `at` steps along its interior path. */
  interiorId: (seat: Seat, at: number) => number
}

const rotate = (cell: Cell, size: number, turns: number): Cell => {
  let [r, c] = cell
  for (let i = 0; i < turns; i++) [r, c] = [size - 1 - c, r] // a quarter turn that carries the top edge to the left edge
  return [r, c]
}

/** Outer ring, counterclockwise on screen, starting at the top-centre square. */
const ringOuter = (n: number): Cell[] => {
  const out: Cell[] = []
  const m = n - 1
  for (let c = (n - 1) / 2; c >= 0; c--) out.push([0, c])
  for (let r = 1; r <= m; r++) out.push([r, 0])
  for (let c = 1; c <= m; c++) out.push([m, c])
  for (let r = m - 1; r >= 0; r--) out.push([r, m])
  for (let c = m - 1; c > (n - 1) / 2; c--) out.push([0, c])
  return out
}

/** A square ring of the given half-width round the centre, clockwise, starting at its top-centre square. */
const ringClockwise = (n: number, inset: number, startAt: 'top' | 'corner'): Cell[] => {
  const lo = inset
  const hi = n - 1 - inset
  const mid = (n - 1) / 2
  const out: Cell[] = []
  if (startAt === 'top') for (let c = mid; c <= hi; c++) out.push([lo, c])
  else for (let c = lo; c <= hi; c++) out.push([lo, c])
  for (let r = lo + 1; r <= hi; r++) out.push([r, hi])
  for (let c = hi - 1; c >= lo; c--) out.push([hi, c])
  for (let r = hi - 1; r > lo; r--) out.push([r, lo])
  if (startAt === 'top') for (let c = lo; c < mid; c++) out.push([lo, c])
  return out
}

/** The 5x5 interior route of the bottom seat, the same shape as the 7x7 inner ring: up from the square above the turn square, along the top, down the right, back along the bottom, then up into Home (row, column). */
const BOTTOM_PATH_5: readonly Cell[] = [[3, 1], [2, 1], [1, 1], [1, 2], [1, 3], [2, 3], [3, 3], [3, 2]]
const INNER5_ID = new Map(INNER_CELLS_5().map(([r, c], i) => [`${r},${c}`, i]))

const LAYOUT5: Layout = {
  size: 5,
  outerLen: 16,
  interiorLen: 8,
  turnAt: 15, // the last outer square: the step after it would be the start square again
  outerCells: OUTER_CELLS_5(),
  interiorCells: INNER_CELLS_5(),
  centre: [2, 2],
  start: [0, 4, 8, 12],
  safe: ['o0', 'o4', 'o8', 'o12', 'c'],
  interiorId: (seat, at) => INNER5_ID.get(rotate(BOTTOM_PATH_5[at], 5, (seat + 2) % 4).join(','))!,
}

/**
 * The interior route of the seat that starts at the bottom middle, read from the owner's arrows (row, column):
 * up the left side of the middle ring, along its top, down its right side, back along its bottom to the square beside where it began,
 * then up into the inner ring's bottom-left corner, up, across, down and back along the inner ring's bottom, and finally up into Home.
 * The other seats walk the same route turned a quarter turn each.
 */
const BOTTOM_PATH: readonly Cell[] = [
  [5, 1], [4, 1], [3, 1], [2, 1], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [5, 4], [5, 3], [5, 2],
  [4, 2], [3, 2], [2, 2], [2, 3], [2, 4], [3, 4], [4, 4], [4, 3],
]

function layout7(): Layout {
  const outerCells = ringOuter(7)
  const middle = ringClockwise(7, 1, 'top') // i0..i15, from (1,3)
  const inner = ringClockwise(7, 2, 'corner') // i16..i23, from (2,2)
  const interiorCells = [...middle, ...inner]
  const idOf = new Map(interiorCells.map(([r, c], i) => [`${r},${c}`, i]))
  const cornerAt = (cell: Cell) => outerCells.findIndex(([r, c]) => r === cell[0] && c === cell[1])
  const safe = ['c', ...([[0, 0], [0, 3], [0, 6], [3, 0], [3, 6], [6, 0], [6, 3], [6, 6]] as Cell[]).map((x) => `o${cornerAt(x)}`), ...([[1, 1], [1, 5], [5, 1], [5, 5]] as Cell[]).map((x) => `i${idOf.get(x.join(','))}`)]
  return {
    size: 7,
    outerLen: 24,
    interiorLen: 24,
    turnAt: 22, // the square two before the start: the cloth's arrows turn inward there, not at the start square
    outerCells,
    interiorCells,
    centre: [3, 3],
    start: [0, 6, 12, 18],
    safe,
    interiorId: (seat, at) => idOf.get(rotate(BOTTOM_PATH[at], 7, (seat + 2) % 4).join(','))!,
  }
}

function OUTER_CELLS_5(): Cell[] {
  return [
    [0, 2], [0, 1], [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [4, 1],
    [4, 2], [4, 3], [4, 4], [3, 4], [2, 4], [1, 4], [0, 4], [0, 3],
  ]
}
function INNER_CELLS_5(): Cell[] {
  return [[1, 2], [1, 3], [2, 3], [3, 3], [3, 2], [3, 1], [2, 1], [1, 1]]
}

export const LAYOUTS: Record<Size, Layout> = { 5: LAYOUT5, 7: layout7() }
export const layoutOf = (size: Size): Layout => LAYOUTS[size]

/** The 5x5 board's squares, kept for the existing tests and tools. */
export const OUTER_CELLS: readonly Cell[] = LAYOUT5.outerCells
export const INNER_CELLS: readonly Cell[] = LAYOUT5.interiorCells
export const CENTRE: Cell = [2, 2]
export const START: readonly number[] = LAYOUT5.start
export const SAFE_KEYS: readonly string[] = LAYOUT5.safe

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
  size: Size
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

export function newGame(size: Size = 5): State {
  const pawns: Pawn[] = []
  for (const seat of SEATS) {
    for (let k = 0; k < PAWNS_PER_SEAT; k++) pawns.push({ id: seat * PAWNS_PER_SEAT + k, seat, where: 'yard', at: 0, credit: false, pinnedBy: null })
  }
  return { size, pawns, jugas: [], turn: 0, phase: 'roll', rolls: [], queue: [], captured: false, entered: [false, false, false, false], nextJuga: 1, winner: null, events: [] }
}

const copy = (s: State): State => JSON.parse(JSON.stringify(s)) as State

// ---------------------------------------------------------------------------------------------------------------
// Squares

export const outerKey = (seat: Seat, at: number, size: Size = 5) => {
  const l = LAYOUTS[size]
  return `o${(l.start[seat] + at) % l.outerLen}`
}
export const innerKey = (seat: Seat, at: number, size: Size = 5) => `i${LAYOUTS[size].interiorId(seat, at)}`
export const isSafe = (key: string, size: Size = 5) => LAYOUTS[size].safe.includes(key)

export function keyOf(seat: Seat, where: Where, at: number, size: Size = 5): string | null {
  if (where === 'outer') return outerKey(seat, at, size)
  if (where === 'inner' || where === 'juga') return innerKey(seat, at, size)
  if (where === 'home') return 'c'
  return null
}

export function cellOf(key: string, size: Size = 5): readonly [number, number] {
  const l = LAYOUTS[size]
  if (key === 'c') return l.centre
  const n = Number(key.slice(1))
  return key[0] === 'o' ? l.outerCells[n] : l.interiorCells[n]
}

export const dice = (random: () => number): [number, number] => [FACES[Math.floor(random() * 4)], FACES[Math.floor(random() * 4)]]

type Occupants = { singles: Pawn[]; jugas: Juga[] }

function occupants(s: State, key: string): Occupants {
  return {
    singles: s.pawns.filter((p) => (p.where === 'outer' || p.where === 'inner') && keyOf(p.seat, p.where, p.at, s.size) === key),
    jugas: s.jugas.filter((j) => innerKey(j.seat, j.at, s.size) === key),
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
    if (p.where === 'outer' || p.where === 'inner') slot(keyOf(p.seat, p.where, p.at, s.size)!).singles.push(p)
    else if (p.where === 'home') slot('c').singles.push(p)
  }
  for (const j of s.jugas) slot(innerKey(j.seat, j.at, s.size)).jugas.push(j)
  return map
}

// ---------------------------------------------------------------------------------------------------------------
// Movement planning (does not change the state)

type Place = { where: 'outer' | 'inner' | 'home'; at: number }

function nextStep(where: 'outer' | 'inner', at: number, credit: boolean, l: Layout): Place {
  if (where === 'outer') {
    // A pawn with capture credit turns inward at its turn square; without credit it keeps circulating the outer ring (§8).
    if (credit && at === l.turnAt) return { where: 'inner', at: 0 }
    return { where: 'outer', at: (at + 1) % l.outerLen }
  }
  return at + 1 < l.interiorLen ? { where: 'inner', at: at + 1 } : { where: 'home', at: 0 }
}

type PawnPlan = { end: Place; path: string[]; capture: number[] }

/** An individual pawn moving `n` squares as one movement (§6, §7, §11, §17). */
export function planPawn(s: State, p: Pawn, n: number): PawnPlan | null {
  if ((p.where !== 'outer' && p.where !== 'inner') || p.pinnedBy !== null || n <= 0) return null
  let place: Place = { where: p.where, at: p.at }
  const path: string[] = []
  for (let i = 0; i < n; i++) {
    if (place.where === 'home') return null // exact count only
    place = nextStep(place.where, place.at, p.credit, LAYOUTS[s.size])
    path.push(place.where === 'home' ? 'c' : keyOf(p.seat, place.where, place.at, s.size)!)
  }
  const dest = path[path.length - 1]
  for (const key of path) {
    if (isSafe(key, s.size)) continue // safe squares override blockades
    const here = occupants(s, key).jugas
    if (here.some((j) => j.seat !== p.seat)) return null // an opposing Juga blocks landing and passing
    if (key === dest && here.length) return null // own Juga: may pass over, may not land
  }
  let capture: number[] = []
  if (dest !== 'c') {
    const here = occupants(s, dest)
    if (here.singles.filter((x) => x.seat === p.seat && x.id !== p.id).length >= 2) return null // at most two friendly pawns
    if (!isSafe(dest, s.size)) capture = here.singles.filter((x) => x.seat !== p.seat).map((x) => x.id)
  }
  return { end: place, path, capture }
}

type JugaPlan = { home: boolean; to: number; captureJugas: number[]; pin: number | null }

/** A Juga moving on `n` movement points, i.e. n / 2 squares (§10, §12 to §15). */
export function planJuga(s: State, j: Juga, n: number): JugaPlan | null {
  if (n <= 0 || n % 2 !== 0) return null
  const to = j.at + n / 2
  const len = LAYOUTS[s.size].interiorLen
  if (to > len) return null
  if (to === len) return { home: true, to, captureJugas: [], pin: null }
  const here = occupants(s, innerKey(j.seat, to, s.size))
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
  return occupants(s, outerKey(seat, 0, s.size)).singles.filter((x) => x.seat === seat).length < 2
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

/** One capture by a player credits every pawn of that player (owner's rule). */
function grantCredit(s: State, seat: Seat) {
  for (const q of s.pawns) if (q.seat === seat) q.credit = true
}

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
    for (let at = 0; at < LAYOUTS[s.size].interiorLen; at++) {
      const key = innerKey(seat, at, s.size)
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
    const total = rollTotal(a, b)
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
    if (plan.capture.length) grantCredit(s, p.seat)
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
      grantCredit(s, pa.seat)
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
        grantCredit(s, pa.seat)
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
  return plan.home ? 'c' : innerKey(j.seat, plan.to, s.size)
}

export const homeCount = (s: State, seat: Seat) => s.pawns.filter((p) => p.seat === seat && p.where === 'home').length
export const yardCount = (s: State, seat: Seat) => s.pawns.filter((p) => p.seat === seat && p.where === 'yard').length

/** Rough progress of a seat, for bots. */
export function progress(s: State, seat: Seat): number {
  let total = 0
  for (const p of s.pawns) {
    if (p.seat !== seat) continue
    if (p.where === 'outer') total += 1 + p.at
    else if (p.where === 'inner' || p.where === 'juga') total += LAYOUTS[s.size].outerLen + 1 + p.at
    else if (p.where === 'home') total += LAYOUTS[s.size].outerLen + LAYOUTS[s.size].interiorLen + 2
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
    const k = keyOf(p.seat, p.where, p.at, s.size)
    if (k) keys.add(k)
  }
  for (const k of keys) {
    if (k === 'c') continue
    const here = occupants(s, k)
    for (const seat of SEATS) {
      if (here.singles.filter((x) => x.seat === seat).length > 2) errors.push(`more than two pawns of ${seat} on ${k}`)
      if (here.jugas.filter((x) => x.seat === seat).length > 1) errors.push(`two Jugas of ${seat} on ${k}`)
    }
    if (!isSafe(k, s.size) && here.jugas.length > 1) errors.push(`two Jugas on ${k}`)
    const seatsHere = new Set(here.singles.map((x) => x.seat))
    if (!isSafe(k, s.size) && seatsHere.size > 1 && !here.jugas.length) errors.push(`opposing pawns share unsafe ${k}`)
  }
  return errors
}
