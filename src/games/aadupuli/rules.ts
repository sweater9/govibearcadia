export type Side = 'goats' | 'tigers'
export type Piece = 'G' | 'T' | null
export type Winner = Side | null
/** Rule choices. The defaults are the common Tamil/South Indian rules (see docs/AADU_PULI_ATTAM.md). */
export type Config = {
  /** Goats the tigers must capture to win: 5 (standard) or 6 (some families). */
  capturesToWin: 5 | 6
  /** When a tiger can capture it must (a common house rule); standard play lets it choose. */
  mustCapture: boolean
  /** Who moves first: goats (standard) or tigers. */
  first: Side
}
export const DEFAULT_CONFIG: Config = { capturesToWin: 5, mustCapture: false, first: 'goats' }
export const isConfig = (c: unknown): c is Config => {
  const v = c as Config
  return !!v && (v.capturesToWin === 5 || v.capturesToWin === 6) && typeof v.mustCapture === 'boolean' && (v.first === 'goats' || v.first === 'tigers')
}
export const normaliseConfig = (c: unknown): Config => (isConfig(c) ? { capturesToWin: c.capturesToWin, mustCapture: c.mustCapture, first: c.first } : DEFAULT_CONFIG)
export const isStandard = (c: Config) => c.capturesToWin === 5 && !c.mustCapture && c.first === 'goats'

export type Move = { from: number | null; to: number; captured: number | null }

export type State = {
  cells: Piece[]
  turn: Side
  goatsPlaced: number
  goatsCaptured: number
  moves: number
  winner: Winner
  config: Config
}

export const POINTS = 23
export const GOATS = 15
export const TIGER_START = [0, 3, 4] as const

/**
 * The authentic 23-point board: apex; three six-point crossbars; four-point base.
 * Each array is one uninterrupted drawn line. Adjacency and jumps are derived from
 * consecutive points, keeping the rules independent from the rendered coordinates.
 */
export const LINES: readonly (readonly number[])[] = [
  [0, 2, 8, 14, 19], [0, 3, 9, 15, 20], [0, 4, 10, 16, 21], [0, 5, 11, 17, 22],
  [1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12], [13, 14, 15, 16, 17, 18], [19, 20, 21, 22],
  [1, 7, 13, 19], [6, 12, 18, 22],
]

export const EDGES: readonly (readonly [number, number])[] = (() => {
  const seen = new Set<string>()
  const out: [number, number][] = []
  for (const line of LINES) for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1]
    const key = a < b ? `${a}-${b}` : `${b}-${a}`
    if (!seen.has(key)) { seen.add(key); out.push([a, b]) }
  }
  return out
})()

export const NEIGHBORS: readonly (readonly number[])[] = Array.from({ length: POINTS }, (_, p) =>
  EDGES.flatMap(([a, b]) => a === p ? [b] : b === p ? [a] : []),
)

/** Ordered jump triples [start, jumped, landing] on every straight board line. */
export const JUMPS: readonly (readonly [number, number, number])[] = LINES.flatMap((line) => {
  const triples: [number, number, number][] = []
  for (let i = 0; i < line.length - 2; i++) {
    triples.push([line[i], line[i + 1], line[i + 2]], [line[i + 2], line[i + 1], line[i]])
  }
  return triples
})

export function newGame(config: Config = DEFAULT_CONFIG): State {
  const cells = Array<Piece>(POINTS).fill(null)
  for (const p of TIGER_START) cells[p] = 'T'
  return { cells, turn: config.first, goatsPlaced: 0, goatsCaptured: 0, moves: 0, winner: null, config }
}

export function legalMoves(s: State): Move[] {
  if (s.winner) return []
  if (s.turn === 'goats' && s.goatsPlaced < GOATS) {
    return s.cells.flatMap((piece, to) => piece === null ? [{ from: null, to, captured: null }] : [])
  }
  const mine: Piece = s.turn === 'goats' ? 'G' : 'T'
  const out: Move[] = []
  for (let from = 0; from < POINTS; from++) {
    if (s.cells[from] !== mine) continue
    for (const to of NEIGHBORS[from]) if (s.cells[to] === null) out.push({ from, to, captured: null })
    if (mine === 'T') for (const [a, over, to] of JUMPS) {
      if (a === from && s.cells[over] === 'G' && s.cells[to] === null) out.push({ from, to, captured: over })
    }
  }
  if (mine === 'T' && s.config.mustCapture) {
    const captures = out.filter((m) => m.captured !== null)
    if (captures.length) return captures
  }
  return out
}

export const movesFrom = (s: State, from: number | null) => legalMoves(s).filter((m) => m.from === from)

export function applyMove(s: State, candidate: Move): State {
  const move = legalMoves(s).find((m) => m.from === candidate.from && m.to === candidate.to)
  if (!move) return s
  const cells = s.cells.slice()
  if (move.from === null) cells[move.to] = 'G'
  else { cells[move.to] = cells[move.from]; cells[move.from] = null }
  if (move.captured !== null) cells[move.captured] = null
  const next: State = {
    cells,
    turn: s.turn === 'goats' ? 'tigers' : 'goats',
    goatsPlaced: s.goatsPlaced + (move.from === null ? 1 : 0),
    goatsCaptured: s.goatsCaptured + (move.captured === null ? 0 : 1),
    moves: s.moves + 1,
    winner: null,
    config: s.config,
  }
  if (next.goatsCaptured >= s.config.capturesToWin) return { ...next, winner: 'tigers' }
  // Goats win only when every tiger lacks both a step and a capture.
  const tigerProbe = { ...next, turn: 'tigers' as const }
  if (legalMoves(tigerProbe).length === 0) return { ...next, winner: 'goats' }
  return next
}

export function isState(value: unknown): value is State {
  const s = value as State
  return !!s && Array.isArray(s.cells) && s.cells.length === POINTS && s.cells.every((p) => p === null || p === 'G' || p === 'T') &&
    (s.turn === 'goats' || s.turn === 'tigers') && Number.isInteger(s.goatsPlaced) && s.goatsPlaced >= 0 && s.goatsPlaced <= GOATS &&
    Number.isInteger(s.goatsCaptured) && s.goatsCaptured >= 0 && s.goatsCaptured <= GOATS && Number.isInteger(s.moves) &&
    (s.winner === null || s.winner === 'goats' || s.winner === 'tigers') && isConfig(s.config) && s.cells.filter((p) => p === 'T').length === 3
}

export const scoreFor = (s: State, human: Side) => s.winner === human ? Math.max(500, 1600 - s.moves * 5) : 0
