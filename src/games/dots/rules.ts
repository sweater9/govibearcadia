import type { Random } from '../../lib/rng'

/**
 * Pure rules for Dots and Boxes. No React or browser APIs.
 *
 * The board is `rows` by `cols` boxes, so (rows + 1) by (cols + 1) dots. Players take turns drawing one line between
 * two adjacent dots. A line that completes the fourth side of a box (or two boxes at once) wins those boxes for the
 * player who drew it, and that player must move again. The game ends when every box is taken; most boxes wins.
 *
 * Lines are numbered: first every horizontal line, row by row ((rows + 1) rows of `cols` lines), then every
 * vertical line, row by row (`rows` rows of (cols + 1) lines). A box is numbered row * cols + col.
 */
export type Player = 1 | 2
export type Level = 'easy' | 'medium' | 'hard'
export const MIN_SIZE = 2
export const MAX_SIZE = 8

export type Move = { edge: number; by: Player; gained: number[] }
export type DState = {
  rows: number
  cols: number
  /** 0 for an undrawn line, otherwise the player who drew it. */
  lines: number[]
  /** 0 for an open box, otherwise its owner. */
  boxes: number[]
  turn: Player
  scores: [number, number]
  log: Move[]
  first: Player
  over: boolean
  /** 0 for a draw (or an unfinished game). */
  winner: 0 | Player
}

export const hCount = (rows: number, cols: number) => (rows + 1) * cols
export const edgeCount = (rows: number, cols: number) => hCount(rows, cols) + rows * (cols + 1)
export const other = (p: Player): Player => (p === 1 ? 2 : 1)

const top = (cols: number, r: number, c: number) => r * cols + c
const bottom = (cols: number, r: number, c: number) => (r + 1) * cols + c
const left = (rows: number, cols: number, r: number, c: number) => hCount(rows, cols) + r * (cols + 1) + c
const right = (rows: number, cols: number, r: number, c: number) => hCount(rows, cols) + r * (cols + 1) + c + 1

/** The four lines around a box. */
export const boxSides = (rows: number, cols: number, box: number): number[] => {
  const r = Math.floor(box / cols)
  const c = box % cols
  return [top(cols, r, c), bottom(cols, r, c), left(rows, cols, r, c), right(rows, cols, r, c)]
}

/** The boxes a line touches (one or two). */
export function edgeBoxes(rows: number, cols: number, edge: number): number[] {
  const h = hCount(rows, cols)
  const out: number[] = []
  if (edge < h) {
    const r = Math.floor(edge / cols)
    const c = edge % cols
    if (r > 0) out.push((r - 1) * cols + c)
    if (r < rows) out.push(r * cols + c)
  } else {
    const k = edge - h
    const r = Math.floor(k / (cols + 1))
    const c = k % (cols + 1)
    if (c > 0) out.push(r * cols + c - 1)
    if (c < cols) out.push(r * cols + c)
  }
  return out
}

/** Where a line lies, for drawing: its two end dots as [row, col] pairs. */
export function edgeDots(rows: number, cols: number, edge: number): [[number, number], [number, number]] {
  const h = hCount(rows, cols)
  if (edge < h) {
    const r = Math.floor(edge / cols)
    const c = edge % cols
    return [[r, c], [r, c + 1]]
  }
  const k = edge - h
  const r = Math.floor(k / (cols + 1))
  const c = k % (cols + 1)
  return [[r, c], [r + 1, c]]
}

export function newGame(rows: number, cols: number, first: Player = 1): DState {
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < MIN_SIZE || cols < MIN_SIZE || rows > MAX_SIZE || cols > MAX_SIZE) throw new Error(`Boards are ${MIN_SIZE} to ${MAX_SIZE} boxes on a side`)
  return { rows, cols, lines: Array(edgeCount(rows, cols)).fill(0), boxes: Array(rows * cols).fill(0), turn: first, scores: [0, 0], log: [], first, over: false, winner: 0 }
}

export const isDrawn = (s: DState, edge: number) => s.lines[edge] !== 0
export const legalMoves = (s: DState): number[] => (s.over ? [] : s.lines.flatMap((v, i) => (v === 0 ? [i] : [])))
const drawnSides = (s: DState, box: number) => boxSides(s.rows, s.cols, box).filter((e) => s.lines[e] !== 0).length

/** Draws a line. An illegal move (already drawn, off the board, game over) returns the same state. */
export function play(s: DState, edge: number): DState {
  if (s.over || !Number.isInteger(edge) || edge < 0 || edge >= s.lines.length || s.lines[edge] !== 0) return s
  const by = s.turn
  const lines = s.lines.slice()
  lines[edge] = by
  const boxes = s.boxes.slice()
  const gained: number[] = []
  for (const b of edgeBoxes(s.rows, s.cols, edge)) {
    if (boxes[b] === 0 && boxSides(s.rows, s.cols, b).every((e) => lines[e] !== 0)) {
      boxes[b] = by
      gained.push(b)
    }
  }
  const scores: [number, number] = [s.scores[0] + (by === 1 ? gained.length : 0), s.scores[1] + (by === 2 ? gained.length : 0)]
  const total = s.rows * s.cols
  const over = scores[0] + scores[1] === total
  return {
    ...s,
    lines,
    boxes,
    scores,
    log: [...s.log, { edge, by, gained }],
    // Completing a box earns another turn; the game ends when every box is taken.
    turn: gained.length > 0 ? by : other(by),
    over,
    winner: over ? (scores[0] > scores[1] ? 1 : scores[1] > scores[0] ? 2 : 0) : 0,
  }
}

/** Rebuilds a game from a list of lines in order (used for undo, replays and tests). */
export function replay(rows: number, cols: number, edges: readonly number[], first: Player = 1): DState {
  return edges.reduce((s, e) => play(s, e), newGame(rows, cols, first))
}

/** Takes back the last whole turn: every move in a row by the player who moved last. */
export function undoTurn(s: DState): DState {
  if (s.log.length === 0) return s
  const last = s.log[s.log.length - 1].by
  let n = s.log.length
  while (n > 0 && s.log[n - 1].by === last) n--
  return replay(s.rows, s.cols, s.log.slice(0, n).map((m) => m.edge), s.first)
}

/**
 * Takes back moves until it is the human's turn to move after the last of their own turns was taken back: the
 * computer's moves are removed first, then the human's last turn. For games against the computer.
 */
export function undoToHuman(s: DState, human: Player): DState {
  let cur = s
  while (cur.log.length > 0 && cur.log[cur.log.length - 1].by !== human) cur = undoTurn(cur)
  return cur.log.length > 0 ? undoTurn(cur) : cur
}

// ---------------------------------------------------------------- analysis (shared by the computer)

/** Boxes with three sides drawn: each can be taken with the one missing line. */
export function capturable(s: DState): number[] {
  const out: number[] = []
  s.boxes.forEach((o, b) => {
    if (o !== 0) return
    const missing = boxSides(s.rows, s.cols, b).filter((e) => s.lines[e] === 0)
    if (missing.length === 1) out.push(missing[0])
  })
  return [...new Set(out)]
}

/** Drawing this line would leave a box with three sides, handing the opponent a box. */
export const givesBox = (s: DState, edge: number): boolean => edgeBoxes(s.rows, s.cols, edge).some((b) => s.boxes[b] === 0 && drawnSides(s, b) === 2)

export const safeMoves = (s: DState): number[] => legalMoves(s).filter((e) => !givesBox(s, e))

/** After this line, how many boxes the opponent can take by greedily capturing everything on offer. */
export function sacrificeCost(s: DState, edge: number): number {
  let cur = play(s, edge)
  const victim = cur.turn
  if (cur.over || victim === s.turn) return 0 // took a box itself, or the game ended
  let n = 0
  for (let guard = 0; guard < 400 && !cur.over && cur.turn === victim; guard++) {
    const take = capturable(cur)
    if (!take.length) break
    const before = cur.scores[victim - 1]
    cur = play(cur, take[0])
    n += cur.scores[victim - 1] - before
  }
  return n
}

// ---------------------------------------------------------------- exact endgame search

export const SOLVE_AT = 13
const NODE_BUDGET = 400_000

/** Best final margin (boxes for the player to move minus the opponent's) from here, or null if the budget ran out. */
export function solveValue(s: DState): number | null {
  if (s.over) return 0
  let nodes = 0
  const memo = new Map<string, number>()
  const lines = s.lines.slice()
  const rows = s.rows
  const cols = s.cols
  const sidesOf = new Map<number, number[]>()
  const sidesFor = (b: number) => sidesOf.get(b) ?? (sidesOf.set(b, boxSides(rows, cols, b)), sidesOf.get(b) as number[])
  const open = s.boxes.map((o) => o === 0)

  const search = (remaining: number[]): number => {
    if (remaining.length === 0) return 0
    if (++nodes > NODE_BUDGET) throw new Error('budget')
    const key = remaining.join(',')
    const hit = memo.get(key)
    if (hit !== undefined) return hit
    let best = -Infinity
    for (const e of remaining) {
      lines[e] = 1
      let got = 0
      const taken: number[] = []
      for (const b of edgeBoxes(rows, cols, e)) if (open[b] && sidesFor(b).every((x) => lines[x] !== 0)) {
        open[b] = false
        taken.push(b)
        got++
      }
      const rest = remaining.filter((x) => x !== e)
      const v = got > 0 ? got + search(rest) : -search(rest)
      lines[e] = 0
      for (const b of taken) open[b] = true
      if (v > best) best = v
    }
    memo.set(key, best)
    return best
  }
  try {
    return search(legalMoves(s))
  } catch {
    return null
  }
}

/** The best line by exact search, or null when the position is too large to solve. */
function solveBest(s: DState, random: Random): number | null {
  const moves = legalMoves(s)
  if (moves.length === 0 || moves.length > SOLVE_AT) return null
  let best: number[] = []
  let bestV = -Infinity
  for (const e of moves) {
    const next = play(s, e)
    const v = solveValue(next)
    if (v === null) return null
    const mine = next.turn === s.turn ? v + (next.scores[s.turn - 1] - s.scores[s.turn - 1]) : -v
    if (mine > bestV) {
      bestV = mine
      best = [e]
    } else if (mine === bestV) best.push(e)
  }
  return best[Math.floor(random() * best.length)]
}

// ---------------------------------------------------------------- the computer

const pickOne = <T,>(items: readonly T[], random: Random): T => items[Math.floor(random() * items.length)]

/**
 * The computer's line. Easy: any legal line. Medium: takes a box when it can, never hands over a box when it has a
 * safe line, and when every line gives something away gives the fewest. Hard: plays like medium until the
 * position is small enough to solve exactly (then it plays perfectly, including declining the last boxes of a chain
 * to keep control), and in the opening prefers safe lines that leave an even number of safe lines, which tends to
 * force the opponent to open the first chain.
 */
export function aiMove(s: DState, level: Level, random: Random): number {
  const moves = legalMoves(s)
  if (moves.length === 0) throw new Error('no legal move')
  if (level === 'easy') return pickOne(moves, random)

  if (level === 'hard') {
    const exact = solveBest(s, random)
    if (exact !== null) return exact
  }
  const take = capturable(s)
  if (take.length) return pickOne(take, random)

  const safe = safeMoves(s)
  if (safe.length) {
    if (level === 'hard') {
      const even = safe.filter((e) => safeMoves(play(s, e)).length % 2 === 0)
      if (even.length) return pickOne(even, random)
    }
    return pickOne(safe, random)
  }
  const costs = moves.map((e) => sacrificeCost(s, e))
  const least = Math.min(...costs)
  return pickOne(moves.filter((_, i) => costs[i] === least), random)
}
