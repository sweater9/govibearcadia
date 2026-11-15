/**
 * Pure rules for Quoridor: a 9x9 board, ten walls each, one pawn each. On your turn you either step your pawn (jumping
 * an adjacent pawn when you can) or place a wall; a wall may never cut a pawn off from its goal row. First to reach the
 * far row wins. No React or browser APIs.
 *
 * Player 1 starts at the bottom (row 8) and heads for row 0; player 2 starts at the top (row 0) and heads for row 8.
 * A wall at (r, c) is two cells long: a horizontal wall lies between rows r and r+1 across columns c and c+1; a vertical
 * wall lies between columns c and c+1 across rows r and r+1. Both r and c run 0 to 7.
 */
export const SIZE = 9
export const WALLS = 10
export type Player = 1 | 2
export type Orient = 'h' | 'v'
export type Wall = { r: number; c: number; o: Orient }
export type Pos = { r: number; c: number }
export type Move = { type: 'pawn'; to: Pos } | { type: 'wall'; wall: Wall }

export type QState = {
  pawns: [Pos, Pos]
  walls: Wall[]
  left: [number, number]
  turn: Player
  winner: 0 | Player
  moves: number
}

export const goalRow = (p: Player) => (p === 1 ? 0 : SIZE - 1)
export const other = (p: Player): Player => (p === 1 ? 2 : 1)
const idx = (p: Player) => p - 1

export function newGame(): QState {
  return { pawns: [{ r: 8, c: 4 }, { r: 0, c: 4 }], walls: [], left: [WALLS, WALLS], turn: 1, winner: 0, moves: 0 }
}
export const isOver = (s: QState) => s.winner !== 0
const inside = (r: number, c: number) => r >= 0 && c >= 0 && r < SIZE && c < SIZE
const has = (walls: readonly Wall[], r: number, c: number, o: Orient) => walls.some((w) => w.r === r && w.c === c && w.o === o)

/** Whether a wall (or the edge) stands between two orthogonally adjacent cells. */
export function blocked(walls: readonly Wall[], r: number, c: number, dr: number, dc: number): boolean {
  if (!inside(r + dr, c + dc)) return true
  if (dc === 0) {
    const top = Math.min(r, r + dr)
    return has(walls, top, c, 'h') || has(walls, top, c - 1, 'h')
  }
  const left = Math.min(c, c + dc)
  return has(walls, r, left, 'v') || has(walls, r - 1, left, 'v')
}

const DIRS: readonly [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]]

/** Cells the pawn of `p` can move to this turn: steps, straight jumps and, when a jump is walled off, diagonal jumps. */
export function pawnMoves(s: QState, p: Player): Pos[] {
  const me = s.pawns[idx(p)]
  const foe = s.pawns[idx(other(p))]
  const out: Pos[] = []
  for (const [dr, dc] of DIRS) {
    if (blocked(s.walls, me.r, me.c, dr, dc)) continue
    const nr = me.r + dr
    const nc = me.c + dc
    if (nr !== foe.r || nc !== foe.c) {
      out.push({ r: nr, c: nc })
      continue
    }
    if (!blocked(s.walls, nr, nc, dr, dc)) {
      out.push({ r: nr + dr, c: nc + dc })
      continue
    }
    for (const [sr, sc] of dr === 0 ? [[-1, 0], [1, 0]] : [[0, -1], [0, 1]]) {
      if (!blocked(s.walls, nr, nc, sr, sc)) out.push({ r: nr + sr, c: nc + sc })
    }
  }
  return out
}

/** Length of the shortest path from `from` to `row`, ignoring pawns, or Infinity when walled in. */
export function pathLength(walls: readonly Wall[], from: Pos, row: number): number {
  const dist = new Int8Array(SIZE * SIZE).fill(-1)
  const queue: number[] = [from.r * SIZE + from.c]
  dist[queue[0]] = 0
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head]
    const r = Math.floor(cur / SIZE)
    const c = cur % SIZE
    if (r === row) return dist[cur]
    for (const [dr, dc] of DIRS) {
      if (blocked(walls, r, c, dr, dc)) continue
      const n = (r + dr) * SIZE + c + dc
      if (dist[n] < 0) {
        dist[n] = dist[cur] + 1
        queue.push(n)
      }
    }
  }
  return Infinity
}
export const distance = (s: QState, p: Player) => pathLength(s.walls, s.pawns[idx(p)], goalRow(p))

/** Whether the wall fits: on the board, not overlapping or crossing another, and no pawn is sealed in. */
export function wallLegal(s: QState, w: Wall): boolean {
  if (!Number.isInteger(w.r) || !Number.isInteger(w.c) || w.r < 0 || w.c < 0 || w.r > 7 || w.c > 7 || (w.o !== 'h' && w.o !== 'v')) return false
  if (s.left[idx(s.turn)] <= 0) return false
  if (has(s.walls, w.r, w.c, w.o)) return false
  if (has(s.walls, w.r, w.c, w.o === 'h' ? 'v' : 'h')) return false
  if (w.o === 'h' && (has(s.walls, w.r, w.c - 1, 'h') || has(s.walls, w.r, w.c + 1, 'h'))) return false
  if (w.o === 'v' && (has(s.walls, w.r - 1, w.c, 'v') || has(s.walls, w.r + 1, w.c, 'v'))) return false
  const walls = [...s.walls, w]
  return pathLength(walls, s.pawns[0], goalRow(1)) < Infinity && pathLength(walls, s.pawns[1], goalRow(2)) < Infinity
}

export function legalWalls(s: QState): Wall[] {
  const out: Wall[] = []
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) for (const o of ['h', 'v'] as const) if (wallLegal(s, { r, c, o })) out.push({ r, c, o })
  return out
}

/** Plays a move for the player to move. Returns the same object when illegal. */
export function apply(s: QState, m: Move): QState {
  if (isOver(s)) return s
  const i = idx(s.turn)
  if (m.type === 'pawn') {
    if (!pawnMoves(s, s.turn).some((p) => p.r === m.to.r && p.c === m.to.c)) return s
    const pawns: [Pos, Pos] = [s.pawns[0], s.pawns[1]]
    pawns[i] = { r: m.to.r, c: m.to.c }
    const next = { ...s, pawns, moves: s.moves + 1 }
    return m.to.r === goalRow(s.turn) ? { ...next, winner: s.turn } : { ...next, turn: other(s.turn) }
  }
  if (!wallLegal(s, m.wall)) return s
  const left: [number, number] = [s.left[0], s.left[1]]
  left[i]--
  return { ...s, walls: [...s.walls, { r: m.wall.r, c: m.wall.c, o: m.wall.o }], left, moves: s.moves + 1, turn: other(s.turn) }
}

export function isState(v: unknown): v is QState {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Partial<QState>
  const pos = (p: unknown) => typeof p === 'object' && p !== null && Number.isInteger((p as Pos).r) && Number.isInteger((p as Pos).c) && inside((p as Pos).r, (p as Pos).c)
  return Array.isArray(s.pawns) && s.pawns.length === 2 && s.pawns.every(pos) && Array.isArray(s.walls) &&
    s.walls.every((w) => typeof w === 'object' && w !== null && (w.o === 'h' || w.o === 'v') && Number.isInteger(w.r) && Number.isInteger(w.c)) &&
    Array.isArray(s.left) && s.left.length === 2 && s.left.every((n) => Number.isInteger(n) && n >= 0 && n <= WALLS) &&
    (s.turn === 1 || s.turn === 2) && (s.winner === 0 || s.winner === 1 || s.winner === 2) && typeof s.moves === 'number'
}

/** A win pays more with walls to spare and the sooner it comes; a loss is worth how close you got. */
export function scoreFor(s: QState): number {
  if (s.winner === 1) return 500 + 25 * s.left[0] + Math.max(0, 300 - 4 * s.moves)
  return Math.max(0, (SIZE - 1 - Math.min(distance(s, 1), SIZE - 1)) * 10)
}

// ---- Computer player ----------------------------------------------------------------------------------------------

export type Level = 'easy' | 'normal' | 'hard'
const DEPTH: Record<Level, number> = { easy: 1, normal: 2, hard: 3 }

/** Position value for `me`: how much shorter my path is than theirs, plus a little for spare walls. */
function evaluate(s: QState, me: Player): number {
  if (s.winner) return s.winner === me ? 1000 : -1000
  const foe = other(me)
  return 10 * (distance(s, foe) - distance(s, me)) + 0.5 * (s.left[idx(me)] - s.left[idx(foe)])
}

/** The pawn steps plus the walls worth considering: those that touch the opponent's shortest path. */
function candidates(s: QState): Move[] {
  const out: Move[] = pawnMoves(s, s.turn).map((to) => ({ type: 'pawn', to }))
  if (s.left[idx(s.turn)] === 0) return out
  const foe = other(s.turn)
  const base = distance(s, foe)
  const f = s.pawns[idx(foe)]
  const near = (w: Wall) => Math.abs(w.r - f.r) <= 2 && Math.abs(w.c - f.c) <= 2
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      for (const o of ['h', 'v'] as const) {
        const w: Wall = { r, c, o }
        if (!near(w) || !wallLegal(s, w)) continue
        if (pathLength([...s.walls, w], s.pawns[idx(foe)], goalRow(foe)) > base) out.push({ type: 'wall', wall: w })
      }
  return out
}

function search(s: QState, me: Player, depth: number, alpha: number, beta: number): number {
  if (depth === 0 || isOver(s)) return evaluate(s, me) * (1 + depth / 100)
  const moves = candidates(s)
  if (s.turn === me) {
    let best = -Infinity
    for (const m of moves) {
      best = Math.max(best, search(apply(s, m), me, depth - 1, alpha, beta))
      alpha = Math.max(alpha, best)
      if (alpha >= beta) break
    }
    return best
  }
  let best = Infinity
  for (const m of moves) {
    best = Math.min(best, search(apply(s, m), me, depth - 1, alpha, beta))
    beta = Math.min(beta, best)
    if (alpha >= beta) break
  }
  return best
}

/** The computer's move for whoever is to move. Easy looks one move ahead and now and then plays a random step. */
export function aiMove(s: QState, random: () => number, level: Level = 'normal'): Move | null {
  if (isOver(s)) return null
  const moves = candidates(s)
  if (!moves.length) return null
  if (level === 'easy' && random() < 0.25) return moves[Math.floor(random() * moves.length)]
  const me = s.turn
  let best = -Infinity
  let pool: Move[] = []
  for (const m of moves) {
    const v = search(apply(s, m), me, DEPTH[level] - 1, -Infinity, Infinity)
    if (v > best + 1e-9) {
      best = v
      pool = [m]
    } else if (Math.abs(v - best) <= 1e-9) pool.push(m)
  }
  return pool[Math.floor(random() * pool.length)]
}
