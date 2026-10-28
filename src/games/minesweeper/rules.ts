import { shuffle, type Random } from '../../lib/rng'

/** Pure Minesweeper rules: no React or browser APIs, so a server can reuse them to validate moves. */

export type CellState = 'hidden' | 'open' | 'flagged'
export type Cell = { mine: boolean; adjacent: number; state: CellState }
export type Status = 'ready' | 'playing' | 'won' | 'lost'
export type Config = { rows: number; cols: number; mines: number }

export type MinesState = {
  config: Config
  cells: Cell[][]
  status: Status
  /** Safe cells opened so far. */
  opened: number
  flags: number
  /** The mine the player hit, when the game is lost. */
  exploded: [number, number] | null
}

export const BEGINNER: Config = { rows: 9, cols: 9, mines: 10 }

const hiddenCell = (): Cell => ({ mine: false, adjacent: 0, state: 'hidden' })

/** A blank board. Mines are placed on the first reveal so the first click can never lose. */
export function newGame(config: Config = BEGINNER): MinesState {
  return {
    config,
    cells: Array.from({ length: config.rows }, () => Array.from({ length: config.cols }, hiddenCell)),
    status: 'ready',
    opened: 0,
    flags: 0,
    exploded: null,
  }
}

export function neighbors(config: Config, r: number, c: number): [number, number][] {
  const out: [number, number][] = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < config.rows && nc >= 0 && nc < config.cols) out.push([nr, nc])
    }
  }
  return out
}

const clone = (cells: Cell[][]): Cell[][] => cells.map((row) => row.map((cell) => ({ ...cell })))

export const safeCellCount = (config: Config): number => config.rows * config.cols - config.mines

export const minesLeft = (state: MinesState): number => state.config.mines - state.flags

/**
 * Chooses mine positions. The first-clicked cell and its neighbours are kept clear so the opening
 * is always a cascade; on a board too crowded for that, only the clicked cell is kept clear.
 */
function placeMines(config: Config, safe: [number, number], random: Random): boolean[][] {
  const total = config.rows * config.cols
  const keepClear = new Set([safe, ...neighbors(config, safe[0], safe[1])].map(([r, c]) => r * config.cols + c))
  let candidates = Array.from({ length: total }, (_, i) => i).filter((i) => !keepClear.has(i))
  if (candidates.length < config.mines) candidates = candidates.concat([...keepClear].filter((i) => i !== safe[0] * config.cols + safe[1]))
  const chosen = new Set(shuffle(candidates, random).slice(0, config.mines))
  return Array.from({ length: config.rows }, (_, r) => Array.from({ length: config.cols }, (_, c) => chosen.has(r * config.cols + c)))
}

function withMines(state: MinesState, safe: [number, number], random: Random): Cell[][] {
  const mines = placeMines(state.config, safe, random)
  const cells = clone(state.cells)
  for (let r = 0; r < state.config.rows; r++) {
    for (let c = 0; c < state.config.cols; c++) {
      cells[r][c].mine = mines[r][c]
      cells[r][c].adjacent = neighbors(state.config, r, c).filter(([nr, nc]) => mines[nr][nc]).length
    }
  }
  return cells
}

function finish(state: MinesState): MinesState {
  if (state.status !== 'playing' || state.opened < safeCellCount(state.config)) return state
  // Cleared: mark every mine so the board reads as solved.
  const cells = clone(state.cells)
  let flags = 0
  for (const row of cells) {
    for (const cell of row) {
      if (cell.mine) cell.state = 'flagged'
      if (cell.state === 'flagged') flags++
    }
  }
  return { ...state, cells, flags, status: 'won' }
}

/**
 * Opens a cell. Returns the *same* object when nothing can happen (finished game, flagged or open
 * cell) so callers can detect no-ops by identity.
 */
export function reveal(state: MinesState, r: number, c: number, random: Random = Math.random): MinesState {
  if (state.status === 'won' || state.status === 'lost') return state
  if (state.cells[r][c].state !== 'hidden') return state

  const cells = state.status === 'ready' ? withMines(state, [r, c], random) : clone(state.cells)
  const base: MinesState = { ...state, cells, status: 'playing' }

  if (cells[r][c].mine) {
    for (const row of cells) for (const cell of row) if (cell.mine && cell.state === 'hidden') cell.state = 'open'
    return { ...base, status: 'lost', exploded: [r, c] }
  }

  let opened = state.opened
  const queue: [number, number][] = [[r, c]]
  while (queue.length) {
    const [cr, cc] = queue.pop()!
    const cell = cells[cr][cc]
    if (cell.state !== 'hidden' || cell.mine) continue
    cell.state = 'open'
    opened++
    if (cell.adjacent === 0) queue.push(...neighbors(state.config, cr, cc))
  }
  return finish({ ...base, opened })
}

/** Toggles a flag on a hidden cell. Open cells and finished games are left alone. */
export function toggleFlag(state: MinesState, r: number, c: number): MinesState {
  if (state.status === 'won' || state.status === 'lost') return state
  const cell = state.cells[r][c]
  if (cell.state === 'open') return state
  const cells = clone(state.cells)
  const flagging = cell.state === 'hidden'
  cells[r][c].state = flagging ? 'flagged' : 'hidden'
  return { ...state, cells, flags: state.flags + (flagging ? 1 : -1) }
}

/**
 * Chording: on an opened number whose flag count matches it, opens every other neighbour at once.
 * A wrong flag therefore loses the game, exactly as in classic Minesweeper.
 */
export function chord(state: MinesState, r: number, c: number, random: Random = Math.random): MinesState {
  const cell = state.cells[r][c]
  if (state.status !== 'playing' || cell.state !== 'open' || cell.adjacent === 0) return state
  const around = neighbors(state.config, r, c)
  if (around.filter(([nr, nc]) => state.cells[nr][nc].state === 'flagged').length !== cell.adjacent) return state

  let next = state
  for (const [nr, nc] of around) {
    if (next.cells[nr][nc].state === 'hidden') next = reveal(next, nr, nc, random)
  }
  return next
}

/**
 * Score: 10 per safe cell opened, so a lost game still earns partial credit.
 * Clearing the board adds 200, plus 2 per second under five minutes.
 */
export function scoreFor(state: MinesState, seconds: number): number {
  const bonus = state.status === 'won' ? 200 + Math.max(0, 300 - Math.floor(seconds)) * 2 : 0
  return state.opened * 10 + bonus
}
