/**
 * Pure rules for Shogi (Japanese chess): 9x9, drops, promotion, check and checkmate. No React or browser APIs.
 *
 * Squares are 0..80, row-major, row 0 at the top. Player 1 (sente, "black") starts at the bottom and moves up; player 2
 * (gote, "white") starts at the top and moves down. A cell is 0 (empty) or kind + 16 for player 2. Kinds: 1 pawn,
 * 2 lance, 3 knight, 4 silver, 5 gold, 6 bishop, 7 rook, 8 king; adding 8 promotes (9 tokin, 10, 11, 12, 14 horse, 15 dragon).
 *
 * Simplifications, stated on the screen as well: a player with no legal move loses (checkmate or not); repeating a
 * position four times is a draw even when it is perpetual check; impasse (both kings in the other camp with ten men
 * each there) and 320 plies are called a draw.
 */
export type Owner = 1 | 2
export const SIZE = 9
export const PAWN = 1
export const LANCE = 2
export const KNIGHT = 3
export const SILVER = 4
export const GOLD = 5
export const BISHOP = 6
export const ROOK = 7
export const KING = 8
export const NAMES = ['', 'pawn', 'lance', 'knight', 'silver', 'gold', 'bishop', 'rook', 'king'] as const
/** The kinds that can be held in hand and dropped. */
export const DROPPABLE = [PAWN, LANCE, KNIGHT, SILVER, GOLD, BISHOP, ROOK] as const

export const ownerOf = (c: number): 0 | Owner => (c === 0 ? 0 : c < 16 ? 1 : 2)
export const kindOf = (c: number) => c & 15
export const make = (kind: number, o: Owner) => kind + (o === 2 ? 16 : 0)
export const other = (o: Owner): Owner => (o === 1 ? 2 : 1)
export const isPromoted = (c: number) => kindOf(c) > 8
const baseKind = (k: number) => (k > 8 ? k - 8 : k)
const canPromote = (k: number) => k === PAWN || k === LANCE || k === KNIGHT || k === SILVER || k === BISHOP || k === ROOK

export const MOVE_LIMIT = 320
export const REPEAT_LIMIT = 4
export const IMPASSE_MEN = 10

export type Move = { from: number; to: number; drop: number; promote: boolean }

export type GState = {
  cells: number[]
  /** Pieces in hand, indexed by kind - 1 (pawn..rook), for player 1 then player 2. */
  hand: [number[], number[]]
  turn: Owner
  winner: 0 | Owner
  draw: boolean
  /** Why the game ended: checkmate, no-moves, sennichite, impasse or move-limit. */
  reason: string
  /** The player to move is in check. */
  check: boolean
  moves: number
  last: { from: number; to: number } | null
  /** How many times each position has occurred, for the four-fold repetition draw. */
  seen: Record<string, number>
}

const zone = (o: Owner, row: number) => (o === 1 ? row <= 2 : row >= 6)
const lastRows = (o: Owner, k: number, row: number) => {
  const far = o === 1 ? row : 8 - row
  return (k === PAWN || k === LANCE) ? far === 0 : k === KNIGHT ? far <= 1 : false
}

const GOLD_STEPS: readonly (readonly [number, number])[] = [[-1, 0], [-1, -1], [-1, 1], [0, -1], [0, 1], [1, 0]]
const DIAG: readonly (readonly [number, number])[] = [[-1, -1], [-1, 1], [1, -1], [1, 1]]
const ORTHO: readonly (readonly [number, number])[] = [[-1, 0], [1, 0], [0, -1], [0, 1]]

/** Calls `fn` with every square the piece on `i` can move to or capture on (its own men excluded). */
function eachTarget(cells: readonly number[], i: number, fn: (to: number) => void): void {
  const c = cells[i]
  const o = ownerOf(c) as Owner
  const k = kindOf(c)
  const sg = o === 1 ? 1 : -1
  const r = (i / 9) | 0
  const col = i % 9
  const step = (dr: number, dc: number) => {
    const rr = r + dr * sg
    const cc = col + dc
    if (rr < 0 || rr > 8 || cc < 0 || cc > 8) return
    const t = rr * 9 + cc
    if (ownerOf(cells[t]) !== o) fn(t)
  }
  const slide = (dr: number, dc: number) => {
    let rr = r + dr * sg
    let cc = col + dc
    while (rr >= 0 && rr <= 8 && cc >= 0 && cc <= 8) {
      const t = rr * 9 + cc
      const oc = ownerOf(cells[t])
      if (oc !== o) fn(t)
      if (oc !== 0) break
      rr += dr * sg
      cc += dc
    }
  }
  switch (k) {
    case PAWN: step(-1, 0); break
    case LANCE: slide(-1, 0); break
    case KNIGHT: step(-2, -1); step(-2, 1); break
    case SILVER: for (const [a, b] of [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 1]]) step(a, b); break
    case BISHOP: for (const [a, b] of DIAG) slide(a, b); break
    case ROOK: for (const [a, b] of ORTHO) slide(a, b); break
    case KING: for (const [a, b] of [...DIAG, ...ORTHO]) step(a, b); break
    case 14: for (const [a, b] of DIAG) slide(a, b); for (const [a, b] of ORTHO) step(a, b); break
    case 15: for (const [a, b] of ORTHO) slide(a, b); for (const [a, b] of DIAG) step(a, b); break
    default: for (const [a, b] of GOLD_STEPS) step(a, b) // gold and the promoted pawn, lance, knight and silver
  }
}

function kingSquare(cells: readonly number[], o: Owner): number {
  const king = make(KING, o)
  return cells.indexOf(king)
}

export function inCheckCells(cells: readonly number[], o: Owner): boolean {
  const ks = kingSquare(cells, o)
  if (ks < 0) return false
  const foe = other(o)
  let hit = false
  for (let i = 0; i < 81 && !hit; i++) {
    if (ownerOf(cells[i]) !== foe) continue
    eachTarget(cells, i, (to) => {
      if (to === ks) hit = true
    })
  }
  return hit
}
export const inCheck = (s: Pick<GState, 'cells'>, o: Owner) => inCheckCells(s.cells, o)

/** Pseudo-legal moves (the mover's king may be left in check). `capturesOnly` skips quiet moves and drops. */
function pseudo(s: Pick<GState, 'cells' | 'hand'>, o: Owner, capturesOnly = false): Move[] {
  const out: Move[] = []
  const { cells } = s
  for (let i = 0; i < 81; i++) {
    const c = cells[i]
    if (ownerOf(c) !== o) continue
    const k = kindOf(c)
    const r = (i / 9) | 0
    eachTarget(cells, i, (to) => {
      if (capturesOnly && cells[to] === 0) return
      const tr = (to / 9) | 0
      const may = canPromote(k) && (zone(o, r) || zone(o, tr))
      if (!lastRows(o, k, tr)) out.push({ from: i, to, drop: 0, promote: false })
      if (may) out.push({ from: i, to, drop: 0, promote: true })
    })
  }
  if (capturesOnly) return out
  const hand = s.hand[o - 1]
  const pawnFile = Array<boolean>(9).fill(false)
  for (let i = 0; i < 81; i++) if (cells[i] === make(PAWN, o)) pawnFile[i % 9] = true
  for (const k of DROPPABLE) {
    if (!hand[k - 1]) continue
    for (let to = 0; to < 81; to++) {
      if (cells[to] !== 0) continue
      if (lastRows(o, k, (to / 9) | 0)) continue
      if (k === PAWN && pawnFile[to % 9]) continue
      out.push({ from: -1, to, drop: k, promote: false })
    }
  }
  return out
}

/** Plays a move without checking it is legal or looking for the end of the game. Used by the search. */
export function stepRaw(s: GState, m: Move): GState {
  const o = s.turn
  const cells = [...s.cells]
  const hand: [number[], number[]] = [[...s.hand[0]], [...s.hand[1]]]
  if (m.drop) {
    cells[m.to] = make(m.drop, o)
    hand[o - 1][m.drop - 1]--
  } else {
    const c = cells[m.from]
    const cap = cells[m.to]
    if (cap) {
      const b = baseKind(kindOf(cap))
      if (b !== KING) hand[o - 1][b - 1]++
    }
    cells[m.from] = 0
    cells[m.to] = m.promote ? c + 8 : c
  }
  return { ...s, cells, hand, turn: other(o) }
}

function hasLegalMove(s: GState, skipPawnMate: boolean): boolean {
  const o = s.turn
  for (const m of pseudo(s, o)) {
    const n = stepRaw(s, m)
    if (inCheckCells(n.cells, o)) continue
    if (!skipPawnMate && m.drop === PAWN && givesPawnMate(n)) continue
    return true
  }
  return false
}

/** A pawn drop that checkmates is not allowed. `n` is the position after the drop. */
function givesPawnMate(n: GState): boolean {
  return inCheckCells(n.cells, n.turn) && !hasLegalMove(n, true)
}

/** Every legal move for the player to move. */
export function legalMoves(s: GState): Move[] {
  if (s.winner !== 0 || s.draw) return []
  const o = s.turn
  const out: Move[] = []
  for (const m of pseudo(s, o)) {
    const n = stepRaw(s, m)
    if (inCheckCells(n.cells, o)) continue
    if (m.drop === PAWN && givesPawnMate(n)) continue
    out.push(m)
  }
  return out
}

/** Captures only, without checking legality: for the search's quiet-position extension. */
export const pseudoCaptures = (s: GState): Move[] => pseudo(s, s.turn, true)

const same = (a: Move, b: Move) => a.from === b.from && a.to === b.to && a.drop === b.drop && a.promote === b.promote

// ---- Positions -----------------------------------------------------------------------------------------------------

const START = 'lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1'
const LETTER: Record<string, number> = { P: PAWN, L: LANCE, N: KNIGHT, S: SILVER, G: GOLD, B: BISHOP, R: ROOK, K: KING }
const LETTERS = ['', 'P', 'L', 'N', 'S', 'G', 'B', 'R', 'K']

export function positionKey(s: Pick<GState, 'cells' | 'hand' | 'turn'>): string {
  return `${s.cells.map((c) => String.fromCharCode(48 + c)).join('')}|${s.hand[0].join('')}|${s.hand[1].join('')}|${s.turn}`
}

/** Builds a state from SFEN ("board turn hands moves"), the usual text format for shogi positions. */
export function fromSfen(sfen: string): GState {
  const [board, side, hands] = sfen.trim().split(/\s+/)
  const cells: number[] = []
  const rows = board.split('/')
  if (rows.length !== 9) throw new Error('bad sfen: need nine rows')
  for (const row of rows) {
    let promoted = false
    let width = 0
    for (const ch of row) {
      if (ch === '+') promoted = true
      else if (ch >= '1' && ch <= '9') {
        for (let n = 0; n < Number(ch); n++) cells.push(0)
        width += Number(ch)
      } else {
        const up = ch.toUpperCase()
        const kind = LETTER[up]
        if (!kind) throw new Error(`bad sfen piece ${ch}`)
        cells.push(make(promoted ? kind + 8 : kind, ch === up ? 1 : 2))
        promoted = false
        width++
      }
    }
    if (width !== 9) throw new Error('bad sfen: row width')
  }
  const hand: [number[], number[]] = [Array(7).fill(0), Array(7).fill(0)]
  if (hands && hands !== '-') {
    let n = ''
    for (const ch of hands) {
      if (ch >= '0' && ch <= '9') n += ch
      else {
        const up = ch.toUpperCase()
        hand[ch === up ? 0 : 1][LETTER[up] - 1] += n ? Number(n) : 1
        n = ''
      }
    }
  }
  const turn: Owner = side === 'w' ? 2 : 1
  const base = { cells, hand, turn }
  return { ...base, winner: 0, draw: false, reason: '', check: inCheckCells(cells, turn), moves: 0, last: null, seen: { [positionKey(base)]: 1 } }
}

export function toSfen(s: GState): string {
  const rows: string[] = []
  for (let r = 0; r < 9; r++) {
    let row = ''
    let gap = 0
    for (let c = 0; c < 9; c++) {
      const cell = s.cells[r * 9 + c]
      if (!cell) { gap++; continue }
      if (gap) { row += gap; gap = 0 }
      const k = kindOf(cell)
      const letter = LETTERS[baseKind(k)]
      row += (k > 8 ? '+' : '') + (ownerOf(cell) === 1 ? letter : letter.toLowerCase())
    }
    rows.push(row + (gap || ''))
  }
  let hands = ''
  for (const o of [1, 2] as Owner[])
    for (const k of [ROOK, BISHOP, GOLD, SILVER, KNIGHT, LANCE, PAWN]) {
      const n = s.hand[o - 1][k - 1]
      if (n) hands += (n > 1 ? n : '') + (o === 1 ? LETTERS[k] : LETTERS[k].toLowerCase())
    }
  return `${rows.join('/')} ${s.turn === 1 ? 'b' : 'w'} ${hands || '-'} ${s.moves + 1}`
}

export const newGame = (): GState => fromSfen(START)
export const isOver = (s: GState) => s.winner !== 0 || s.draw

function impasse(cells: readonly number[]): boolean {
  const k1 = kingSquare(cells, 1)
  const k2 = kingSquare(cells, 2)
  if (k1 < 0 || k2 < 0 || !zone(1, (k1 / 9) | 0) || !zone(2, (k2 / 9) | 0)) return false
  let a = 0
  let b = 0
  for (let i = 0; i < 81; i++) {
    const c = cells[i]
    if (!c || kindOf(c) === KING) continue
    const row = (i / 9) | 0
    if (ownerOf(c) === 1 && zone(1, row)) a++
    if (ownerOf(c) === 2 && zone(2, row)) b++
  }
  return a >= IMPASSE_MEN && b >= IMPASSE_MEN
}

/** Plays a legal move and works out whether the game is over. Returns the same object when the move is illegal. */
export function apply(s: GState, m: Move): GState {
  if (isOver(s) || !legalMoves(s).some((x) => same(x, m))) return s
  const mover = s.turn
  const n = stepRaw(s, m)
  const key = positionKey(n)
  const seen = { ...s.seen, [key]: (s.seen[key] ?? 0) + 1 }
  const check = inCheckCells(n.cells, n.turn)
  const next: GState = { ...n, check, moves: s.moves + 1, last: { from: m.from, to: m.to }, seen }
  if (!hasLegalMove(next, false)) return { ...next, winner: mover, reason: check ? 'checkmate' : 'no-moves' }
  if (seen[key] >= REPEAT_LIMIT) return { ...next, draw: true, reason: 'sennichite' }
  if (impasse(next.cells)) return { ...next, draw: true, reason: 'impasse' }
  if (next.moves >= MOVE_LIMIT) return { ...next, draw: true, reason: 'move-limit' }
  return next
}

export function isState(v: unknown): v is GState {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Partial<GState>
  const hand = s.hand
  return Array.isArray(s.cells) && s.cells.length === 81 && s.cells.every((c) => Number.isInteger(c) && c >= 0 && c < 32) &&
    Array.isArray(hand) && hand.length === 2 && hand.every((h) => Array.isArray(h) && h.length === 7 && h.every((n) => Number.isInteger(n) && n >= 0 && n <= 18)) &&
    (s.turn === 1 || s.turn === 2) && (s.winner === 0 || s.winner === 1 || s.winner === 2) && typeof s.draw === 'boolean' &&
    typeof s.reason === 'string' && typeof s.check === 'boolean' && typeof s.moves === 'number' && typeof s.seen === 'object' && s.seen !== null
}

/** A win pays more the sooner it comes; a draw is worth something; a loss nothing. Player 1 is the human. */
export function scoreFor(s: GState): number {
  if (s.winner === 1) return 600 + Math.max(0, 400 - s.moves * 2)
  return s.draw ? 200 : 0
}

/** Legal moves of the piece on `from`, or the drops of kind `drop`. */
export const movesFor = (s: GState, from: number, drop = 0): Move[] => legalMoves(s).filter((m) => (drop ? m.drop === drop : m.from === from && !m.drop))

export const RULES_NOTE = 'No legal move loses. Four repeats is a draw. Both kings in the other camp with ten men each is a draw (impasse).'
