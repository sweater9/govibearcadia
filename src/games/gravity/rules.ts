/** Pure Gravity Flip rules: a turn-based gravity puzzle on a grid. No React or browser APIs. */

export type Cell = '#' | '.' | '^' | 'S' | 'E'
export type Gravity = 1 | -1 // 1 = falls down, -1 = falls up
export type Status = 'playing' | 'won' | 'dead'

export type Level = { name: string; rows: string[] }

/**
 * Levels. '#' wall, '.' empty, '^' spikes, 'S' start, 'E' exit. Every level is closed by walls.
 * Each one is checked by the tests to be solvable; par is computed by search, not written by hand.
 */
export const LEVELS: readonly Level[] = [
  {
    name: 'First flip',
    rows: [
      '############',
      '#..........#',
      '#..........#',
      '#.........E#',
      '#S.........#',
      '############',
    ],
  },
  {
    name: 'Over the wall',
    rows: [
      '############',
      '#..........#',
      '#....#.....#',
      '#....#.....#',
      '#S...#....E#',
      '############',
    ],
  },
  {
    name: 'Spiked floor',
    rows: [
      '#############',
      '#...........#',
      '#...........#',
      '#S..^^^^^..E#',
      '#############',
    ],
  },
  {
    name: 'Mind the gap',
    rows: [
      '#############',
      '#...........#',
      '#...........#',
      '#S.........E#',
      '####..#######',
      '####^^#######',
      '#############',
    ],
  },
  {
    name: 'Pillars',
    rows: [
      '#############',
      '#...........#',
      '#..#..#..#..#',
      '#..#..#..#.E#',
      '#S.#..#..#..#',
      '#..#.....#..#',
      '#############',
    ],
  },
  {
    name: 'Spike corridor',
    rows: [
      '##############',
      '#.....^.....E#',
      '#............#',
      '#S..^.....^..#',
      '##############',
    ],
  },
  {
    name: 'Down the well',
    rows: [
      '#########',
      '#S......#',
      '#.#####.#',
      '#.#...#.#',
      '#.#.E.#.#',
      '#.#.#.#.#',
      '#...#...#',
      '#########',
    ],
  },
  {
    name: 'Switchback',
    rows: [
      '###########',
      '#........E#',
      '#.#######.#',
      '#.#.....#.#',
      '#.#.###.#.#',
      '#S..#.....#',
      '###########',
    ],
  },
  {
    name: 'Ping-pong',
    rows: [
      '###############',
      '#...^.....^..E#',
      '#.............#',
      '#S....^.....^.#',
      '###############',
    ],
  },
  {
    name: 'Crossfire',
    rows: [
      '###############',
      '#S....#.......#',
      '#.....#.......#',
      '#...#.#...#...#',
      '#.#.#...#.#.E.#',
      '#.#.###.#.###.#',
      '#.............#',
      '###############',
    ],
  },
]

export const parseLevel = (level: Level) => {
  const rows = level.rows
  const h = rows.length
  const w = rows[0].length
  let start = { x: 0, y: 0 }
  let exit = { x: 0, y: 0 }
  const cells: Cell[][] = rows.map((row, y) =>
    [...row].map((ch, x) => {
      if (ch === 'S') start = { x, y }
      if (ch === 'E') exit = { x, y }
      return ch as Cell
    }),
  )
  return { w, h, cells, start, exit }
}

export type Snapshot = { x: number; y: number; g: Gravity; moves: number }
export type GravityState = {
  level: number
  x: number
  y: number
  g: Gravity
  moves: number
  /** Positions before each move, newest last, for undo. */
  history: Snapshot[]
  status: Status
}

/** A fresh attempt: the player starts at S and drops to rest before the first move. */
export function newGame(level = 0): GravityState {
  const { start } = parseLevel(LEVELS[level])
  const p = settle(level, start.x, start.y, 1)
  return { level, x: p.x, y: p.y, g: 1, moves: 0, history: [], status: p.status }
}

type Pos = { x: number; y: number; g: Gravity; status: Status }

/** Lets the player fall in the direction of gravity until something solid stops them, checking each cell entered. */
function settle(level: number, x: number, y: number, g: Gravity): Pos {
  const { cells, w, h } = parseLevel(LEVELS[level])
  const solid = (cx: number, cy: number) => cx < 0 || cy < 0 || cx >= w || cy >= h || cells[cy][cx] === '#'
  const check = (): Status | null => (cells[y][x] === '^' ? 'dead' : cells[y][x] === 'E' ? 'won' : null)
  let at = check()
  while (!at && !solid(x, y + g)) {
    y += g
    at = check()
  }
  return { x, y, g, status: at ?? 'playing' }
}

const record = (s: GravityState, p: Pos): GravityState => ({
  ...s,
  x: p.x,
  y: p.y,
  g: p.g,
  moves: s.moves + 1,
  status: p.status,
  history: [...s.history, { x: s.x, y: s.y, g: s.g, moves: s.moves }],
})

/** Steps one cell left or right, then falls. Walking into a wall does nothing and costs nothing. */
export function move(state: GravityState, dir: -1 | 1): GravityState {
  if (state.status !== 'playing') return state
  const { cells, w } = parseLevel(LEVELS[state.level])
  const nx = state.x + dir
  if (nx < 0 || nx >= w || cells[state.y][nx] === '#') return state
  return record(state, settle(state.level, nx, state.y, state.g))
}

/** Reverses gravity, then falls. Always costs a move. */
export function flip(state: GravityState): GravityState {
  if (state.status !== 'playing') return state
  const g = (state.g * -1) as Gravity
  return record(state, settle(state.level, state.x, state.y, g))
}

/** Takes back the last move (also after dying). */
export function undo(state: GravityState): GravityState {
  const last = state.history[state.history.length - 1]
  if (!last || state.status === 'won') return state
  return { ...state, x: last.x, y: last.y, g: last.g, moves: last.moves, history: state.history.slice(0, -1), status: 'playing' }
}

/** Back to the start of the level. */
export const restart = (state: GravityState): GravityState => newGame(state.level)

export type Action = 'L' | 'R' | 'F'

/** Applies one action. */
export const act = (s: GravityState, a: Action): GravityState => (a === 'F' ? flip(s) : move(s, a === 'L' ? -1 : 1))

/** A shortest solution as a list of actions, by breadth-first search; null if the level cannot be solved. */
export function solve(level: number): Action[] | null {
  const key = (s: GravityState) => `${s.x},${s.y},${s.g}`
  const first = newGame(level)
  if (first.status === 'won') return []
  const seen = new Set([key(first)])
  let frontier: { s: GravityState; path: Action[] }[] = [{ s: first, path: [] }]
  for (let depth = 1; frontier.length && depth < 200; depth++) {
    const next: typeof frontier = []
    for (const { s, path } of frontier) {
      for (const a of ['L', 'R', 'F'] as Action[]) {
        const n = act(s, a)
        if (n === s) continue
        if (n.status === 'won') return [...path, a]
        if (n.status === 'dead') continue
        const k = key(n)
        if (seen.has(k)) continue
        seen.add(k)
        next.push({ s: { ...n, history: [] }, path: [...path, a] })
      }
    }
    frontier = next
  }
  return null
}

/** The fewest moves that solve a level; null if it cannot be solved. */
export const par = (level: number): number | null => solve(level)?.length ?? null

/** 3 stars for par, 2 for within 3 moves of it, otherwise 1. */
export const starsFor = (moves: number, parMoves: number): 1 | 2 | 3 => (moves <= parMoves ? 3 : moves <= parMoves + 3 ? 2 : 1)

/** 1000 for par, 50 less per extra move, never below 100. */
export const scoreFor = (moves: number, parMoves: number): number => Math.max(100, 1000 - 50 * Math.max(0, moves - parMoves))
