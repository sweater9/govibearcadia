/**
 * Pure rules for Go on a 9x9 or 13x13 board: captures, no suicide, positional superko (no move may recreate an
 * earlier whole-board position), pass, and two passes in a row end the game. Area (Chinese) scoring: your stones plus
 * the empty regions only you border, with 6.5 komi to white. Dead stones are not removed: the game is counted as it
 * stands, so capture or surround what you want counted before you pass. No React or browser APIs.
 *
 * Black (1) is you and moves first; white (2) is the computer.
 */
export type Color = 1 | 2
export type Size = 9 | 13
export const SIZES: readonly Size[] = [9, 13]
export const KOMI = 6.5

export type GState = {
  size: Size
  /** Row-major, 0 empty, 1 black, 2 white. */
  cells: number[]
  turn: Color
  /** Consecutive passes. Two end the game. */
  passes: number
  /** Every whole-board position so far, for superko. */
  seen: string[]
  /** Stones each player has captured: [by black, by white]. */
  captures: [number, number]
  over: boolean
  moves: number
  /** The last point played, -1 for a pass, null at the start. */
  last: number | null
}

export const other = (c: Color): Color => (c === 1 ? 2 : 1)

const NB_CACHE = new Map<number, number[][]>()
export function neighbours(size: number): number[][] {
  let nb = NB_CACHE.get(size)
  if (!nb) {
    nb = Array.from({ length: size * size }, (_, p) => {
      const x = p % size
      const y = Math.floor(p / size)
      const out: number[] = []
      if (y > 0) out.push(p - size)
      if (x > 0) out.push(p - 1)
      if (x < size - 1) out.push(p + 1)
      if (y < size - 1) out.push(p + size)
      return out
    })
    NB_CACHE.set(size, nb)
  }
  return nb
}

/** The group containing the stone at `p`, and its liberties. */
export function groupAt(cells: readonly number[], size: number, p: number): { stones: number[]; liberties: number[] } {
  const colour = cells[p]
  const nb = neighbours(size)
  const stones = [p]
  const seen = new Set<number>([p])
  const libs = new Set<number>()
  for (let i = 0; i < stones.length; i++) {
    for (const q of nb[stones[i]]) {
      if (cells[q] === 0) libs.add(q)
      else if (cells[q] === colour && !seen.has(q)) {
        seen.add(q)
        stones.push(q)
      }
    }
  }
  return { stones, liberties: [...libs] }
}

/** Places a stone and removes captured groups. Null when the point is taken or the move would be suicide. Ignores ko. */
export function tryMove(cells: readonly number[], size: number, p: number, colour: Color): { cells: number[]; captured: number } | null {
  if (cells[p] !== 0) return null
  const next = [...cells]
  next[p] = colour
  const nb = neighbours(size)
  let captured = 0
  for (const q of nb[p]) {
    if (next[q] === other(colour)) {
      const g = groupAt(next, size, q)
      if (g.liberties.length === 0) {
        for (const s of g.stones) next[s] = 0
        captured += g.stones.length
      }
    }
  }
  if (groupAt(next, size, p).liberties.length === 0) return null
  return { cells: next, captured }
}

export function newGame(size: Size = 9): GState {
  const cells = Array<number>(size * size).fill(0)
  return { size, cells, turn: 1, passes: 0, seen: [cells.join('')], captures: [0, 0], over: false, moves: 0, last: null }
}

export const isOver = (s: GState) => s.over
/** Games that run this long are called, so a pair of stubborn players cannot play forever. */
export const moveCap = (size: number) => size * size * 3

/** Plays a stone for the player to move. Returns the same object when the move is illegal. */
export function play(s: GState, p: number): GState {
  if (s.over || !Number.isInteger(p) || p < 0 || p >= s.cells.length) return s
  const r = tryMove(s.cells, s.size, p, s.turn)
  if (!r) return s
  const key = r.cells.join('')
  if (s.seen.includes(key)) return s
  const captures: [number, number] = [...s.captures]
  captures[s.turn - 1] += r.captured
  const moves = s.moves + 1
  return { ...s, cells: r.cells, turn: other(s.turn), passes: 0, seen: [...s.seen, key], captures, moves, last: p, over: moves >= moveCap(s.size) }
}

export function pass(s: GState): GState {
  if (s.over) return s
  const passes = s.passes + 1
  const moves = s.moves + 1
  return { ...s, turn: other(s.turn), passes, moves, last: -1, over: passes >= 2 || moves >= moveCap(s.size) }
}

export const isLegal = (s: GState, p: number): boolean => play(s, p) !== s

// ---- Scoring ------------------------------------------------------------------------------------------------------

export type Area = { black: number; white: number; blackStones: number; whiteStones: number; blackTerritory: number; whiteTerritory: number; neutral: number }

export function scoreArea(cells: readonly number[], size: number): Area {
  const nb = neighbours(size)
  const a: Area = { black: 0, white: 0, blackStones: 0, whiteStones: 0, blackTerritory: 0, whiteTerritory: 0, neutral: 0 }
  const seen = new Set<number>()
  for (let p = 0; p < cells.length; p++) {
    if (cells[p] === 1) a.blackStones++
    else if (cells[p] === 2) a.whiteStones++
    else if (!seen.has(p)) {
      const region = [p]
      seen.add(p)
      let touchesBlack = false
      let touchesWhite = false
      for (let i = 0; i < region.length; i++) {
        for (const q of nb[region[i]]) {
          if (cells[q] === 0) {
            if (!seen.has(q)) {
              seen.add(q)
              region.push(q)
            }
          } else if (cells[q] === 1) touchesBlack = true
          else touchesWhite = true
        }
      }
      if (touchesBlack && !touchesWhite) a.blackTerritory += region.length
      else if (touchesWhite && !touchesBlack) a.whiteTerritory += region.length
      else a.neutral += region.length
    }
  }
  a.black = a.blackStones + a.blackTerritory
  a.white = a.whiteStones + a.whiteTerritory
  return a
}

/** Black's margin over white including komi; positive means black wins. Never zero because of the half point. */
export const margin = (s: GState): number => {
  const a = scoreArea(s.cells, s.size)
  return a.black - a.white - KOMI
}
export const winner = (s: GState): Color => (margin(s) > 0 ? 1 : 2)

/** A win pays more the bigger it is, and more on the larger board; a loss is worth a little for a close game. */
export function scoreFor(s: GState): number {
  const m = Math.round(margin(s))
  return m > 0 ? 400 + 15 * m + (s.size === 13 ? 100 : 0) : Math.max(0, 100 + 5 * m)
}

export function isState(v: unknown): v is GState {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Partial<GState>
  return (s.size === 9 || s.size === 13) && Array.isArray(s.cells) && s.cells.length === s.size * s.size && s.cells.every((c) => c === 0 || c === 1 || c === 2) &&
    (s.turn === 1 || s.turn === 2) && typeof s.passes === 'number' && Array.isArray(s.seen) && Array.isArray(s.captures) && typeof s.over === 'boolean'
}

// ---- Computer player ----------------------------------------------------------------------------------------------

export type Level = 'easy' | 'normal' | 'hard'
type Random = () => number

/** An empty point surrounded by your own stones, which you should almost never fill. */
export function isOwnEye(cells: readonly number[], size: number, p: number, colour: Color): boolean {
  if (cells[p] !== 0) return false
  const nb = neighbours(size)
  if (!nb[p].every((q) => cells[q] === colour)) return false
  const x = p % size
  const y = Math.floor(p / size)
  let bad = 0
  let onBoard = 0
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue
    onBoard++
    if (cells[ny * size + nx] !== colour) bad++
  }
  return onBoard === 4 ? bad <= 1 : bad === 0
}

const lineOf = (p: number, size: number) => Math.min(p % size, Math.floor(p / size), size - 1 - (p % size), size - 1 - Math.floor(p / size))

/** A quick judgement of one move: captures, rescues, ataris, self-atari, eyes, edges. Higher is better. */
function judge(s: GState, p: number, colour: Color, r: { cells: number[]; captured: number }): number {
  const { size, cells } = s
  const nb = neighbours(size)
  let v = 12 * r.captured
  const mine = groupAt(r.cells, size, p)
  // Rescuing a group that was in atari.
  for (const q of nb[p]) {
    if (cells[q] === colour) {
      const before = groupAt(cells, size, q)
      if (before.liberties.length === 1 && mine.liberties.length >= 2) v += 5 + before.stones.length
    } else if (cells[q] === other(colour) && r.cells[q] === other(colour)) {
      const g = groupAt(r.cells, size, q)
      if (g.liberties.length === 1) v += 3 + g.stones.length
    }
  }
  if (mine.liberties.length === 1 && r.captured === 0) v -= 10
  v += Math.min(4, mine.liberties.length)
  const line = lineOf(p, size)
  v += line === 0 ? -3 : line === 1 ? 0 : line <= 3 ? 2 : 1
  if (nb[p].some((q) => cells[q] !== 0)) v += 1
  return v
}

type Candidate = { p: number; v: number }

/** Every legal, sensible move for the player to move, best first. Excludes filling your own eyes. */
function candidates(s: GState, random: Random): Candidate[] {
  const out: Candidate[] = []
  for (let p = 0; p < s.cells.length; p++) {
    if (s.cells[p] !== 0 || isOwnEye(s.cells, s.size, p, s.turn)) continue
    const r = tryMove(s.cells, s.size, p, s.turn)
    if (!r || s.seen.includes(r.cells.join(''))) continue
    out.push({ p, v: judge(s, p, s.turn, r) + random() * 0.5 })
  }
  return out.sort((a, b) => b.v - a.v)
}

/** One random game to the end from a position; returns black's area minus white's, without komi. */
function playout(start: number[], size: number, toMove: Color, random: Random, cap: number): number {
  let cells = start
  let colour = toMove
  let passes = 0
  let ko = -1
  const n = size * size
  for (let i = 0; i < cap && passes < 2; i++) {
    let done = false
    for (let attempt = 0; attempt < 24 && !done; attempt++) {
      const p = Math.floor(random() * n)
      if (cells[p] !== 0 || p === ko || isOwnEye(cells, size, p, colour)) continue
      const r = tryMove(cells, size, p, colour)
      if (!r) continue
      ko = r.captured === 1 && groupAt(r.cells, size, p).stones.length === 1 && groupAt(r.cells, size, p).liberties.length === 1 ? cells.findIndex((c, q) => c !== 0 && r.cells[q] === 0) : -1
      cells = r.cells
      done = true
    }
    if (done) passes = 0
    else {
      passes++
      ko = -1
    }
    colour = other(colour)
  }
  const a = scoreArea(cells, size)
  return a.black - a.white
}

/** Playouts per candidate move on Hard, kept small so the computer answers quickly and the same way every time. */
const PLAYOUTS: Record<Size, number> = { 9: 28, 13: 12 }
const HARD_BREADTH = 8

/** The computer's choice: a point, or 'pass'. Deterministic for a given random source. */
export function aiChoose(s: GState, random: Random, level: Level = 'normal'): number | 'pass' {
  const me = s.turn
  // After the opponent passes, pass back if the count already favours the computer, so the game can end.
  if (s.passes >= 1) {
    const m = margin(s)
    if ((me === 2 && m < 0) || (me === 1 && m > 0)) return 'pass'
  }
  const list = candidates(s, random)
  if (list.length === 0) return 'pass'

  if (level === 'easy') {
    // Take a capture or rescue when one is on offer most of the time, otherwise play something sensible but loose.
    const top = list[0]
    if (top.v >= 12 && random() < 0.7) return top.p
    const pool = list.filter((c) => lineOf(c.p, s.size) >= 1)
    const from = pool.length ? pool : list
    return from[Math.floor(random() * from.length)].p
  }

  const best = list[0]
  // Late in the game, with nothing useful left, pass rather than fill your own territory.
  if (best.v < 1 && s.moves > s.size * s.size * 0.5) return 'pass'
  if (level === 'normal') return best.p

  // Hard: a flat Monte Carlo over the best few moves, playouts decide among them.
  const breadth = list.slice(0, HARD_BREADTH)
  const cap = s.size * s.size * 2
  let pick = breadth[0].p
  let top = -Infinity
  for (const c of breadth) {
    const r = tryMove(s.cells, s.size, c.p, me)!
    let wins = 0
    for (let i = 0; i < PLAYOUTS[s.size]; i++) {
      const diff = playout(r.cells, s.size, other(me), random, cap)
      const blackWins = diff - KOMI > 0
      if ((me === 1) === blackWins) wins++
    }
    const v = wins + c.v * 0.05
    if (v > top) {
      top = v
      pick = c.p
    }
  }
  return pick
}

/** Applies the computer's choice. */
export function aiPlay(s: GState, random: Random, level: Level = 'normal'): GState {
  const c = aiChoose(s, random, level)
  return c === 'pass' ? pass(s) : play(s, c)
}
