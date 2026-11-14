/** Board squares 0..63 in FEN order: 0 is a8, 7 is h8, 56 is a1, 63 is h1. Pieces are letters: white upper case, black lower case, '' for empty. */
export type Color = 'w' | 'b'
export type Promo = 'q' | 'r' | 'b' | 'n'
export type Move = { from: number; to: number; promo?: Promo }
export type State = {
  board: string[]
  turn: Color
  /** Subset of "KQkq". */
  castling: string
  /** En passant target square, or -1. */
  ep: number
  /** Half-moves since the last capture or pawn move. */
  half: number
  full: number
  /** Position keys since the last irreversible move, for threefold repetition. */
  keys: string[]
}
export type Status = 'playing' | 'checkmate' | 'stalemate' | 'fifty-moves' | 'repetition' | 'material'

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const FILES = 'abcdefgh'
export const squareName = (sq: number) => `${FILES[sq % 8]}${8 - Math.floor(sq / 8)}`
export const squareOf = (name: string) => (8 - Number(name[1])) * 8 + FILES.indexOf(name[0])
const colorOf = (p: string): Color => (p === p.toUpperCase() ? 'w' : 'b')
const other = (c: Color): Color => (c === 'w' ? 'b' : 'w')

export function fromFen(fen: string): State {
  const [place, turn, castling, ep, half = '0', full = '1'] = fen.trim().split(/\s+/)
  const board: string[] = []
  for (const ch of place) {
    if (ch === '/') continue
    if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) board.push('')
    else board.push(ch)
  }
  const s: State = { board, turn: turn === 'b' ? 'b' : 'w', castling: castling === '-' ? '' : castling, ep: !ep || ep === '-' ? -1 : squareOf(ep), half: Number(half), full: Number(full), keys: [] }
  return { ...s, keys: [key(s)] }
}
export function toFen(s: State): string {
  const rows: string[] = []
  for (let r = 0; r < 8; r++) {
    let row = ''
    let gap = 0
    for (let f = 0; f < 8; f++) {
      const p = s.board[r * 8 + f]
      if (!p) gap++
      else { if (gap) row += gap; gap = 0; row += p }
    }
    rows.push(row + (gap || ''))
  }
  return `${rows.join('/')} ${s.turn} ${s.castling || '-'} ${s.ep < 0 ? '-' : squareName(s.ep)} ${s.half} ${s.full}`
}
const key = (s: State) => `${s.board.join(',')}|${s.turn}|${s.castling}|${s.ep}`
export const newGame = (): State => fromFen(START_FEN)

const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]]
const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]]

/** True if `by` attacks the square. */
export function attacked(board: string[], sq: number, by: Color): boolean {
  const r = Math.floor(sq / 8)
  const f = sq % 8
  const at = (rr: number, ff: number) => (rr < 0 || rr > 7 || ff < 0 || ff > 7 ? undefined : board[rr * 8 + ff])
  const mine = (p: string | undefined, kinds: string) => !!p && colorOf(p) === by && kinds.includes(p.toLowerCase())
  const pr = by === 'w' ? r + 1 : r - 1 // a white pawn attacks upward, so it sits one rank below the target
  if (mine(at(pr, f - 1), 'p') || mine(at(pr, f + 1), 'p')) return true
  for (const [dr, df] of KNIGHT) if (mine(at(r + dr, f + df), 'n')) return true
  for (const [dr, df] of KING) if (mine(at(r + dr, f + df), 'k')) return true
  for (const [dirs, kinds] of [[DIAG, 'bq'], [ORTH, 'rq']] as const) {
    for (const [dr, df] of dirs) {
      let rr = r + dr
      let ff = f + df
      while (rr >= 0 && rr <= 7 && ff >= 0 && ff <= 7) {
        const p = board[rr * 8 + ff]
        if (p) { if (mine(p, kinds)) return true; break }
        rr += dr
        ff += df
      }
    }
  }
  return false
}

const kingSquare = (board: string[], c: Color) => board.indexOf(c === 'w' ? 'K' : 'k')
export const inCheck = (s: State, c: Color = s.turn) => attacked(s.board, kingSquare(s.board, c), other(c))

function pseudoMoves(s: State): Move[] {
  const out: Move[] = []
  const { board, turn } = s
  const push = (from: number, to: number, promo = false) => {
    if (promo) for (const p of ['q', 'r', 'b', 'n'] as const) out.push({ from, to, promo: p })
    else out.push({ from, to })
  }
  for (let from = 0; from < 64; from++) {
    const p = board[from]
    if (!p || colorOf(p) !== turn) continue
    const r = Math.floor(from / 8)
    const f = from % 8
    const kind = p.toLowerCase()
    if (kind === 'p') {
      const dir = turn === 'w' ? -1 : 1
      const startRank = turn === 'w' ? 6 : 1
      const lastRank = turn === 'w' ? 0 : 7
      const one = (r + dir) * 8 + f
      if (r + dir >= 0 && r + dir <= 7 && !board[one]) {
        push(from, one, r + dir === lastRank)
        const two = (r + 2 * dir) * 8 + f
        if (r === startRank && !board[two]) push(from, two)
      }
      for (const df of [-1, 1]) {
        const ff = f + df
        if (ff < 0 || ff > 7 || r + dir < 0 || r + dir > 7) continue
        const to = (r + dir) * 8 + ff
        if ((board[to] && colorOf(board[to]) !== turn) || to === s.ep) push(from, to, r + dir === lastRank)
      }
    } else if (kind === 'n' || kind === 'k') {
      for (const [dr, df] of kind === 'n' ? KNIGHT : KING) {
        const rr = r + dr
        const ff = f + df
        if (rr < 0 || rr > 7 || ff < 0 || ff > 7) continue
        const to = rr * 8 + ff
        if (!board[to] || colorOf(board[to]) !== turn) push(from, to)
      }
    } else {
      for (const [dr, df] of kind === 'b' ? DIAG : kind === 'r' ? ORTH : [...DIAG, ...ORTH]) {
        let rr = r + dr
        let ff = f + df
        while (rr >= 0 && rr <= 7 && ff >= 0 && ff <= 7) {
          const to = rr * 8 + ff
          if (board[to]) { if (colorOf(board[to]) !== turn) push(from, to); break }
          push(from, to)
          rr += dr
          ff += df
        }
      }
    }
  }
  // Castling: the right is still held, the squares between are empty, and the king neither starts in, passes through, nor lands in check.
  const home = turn === 'w' ? 60 : 4
  const foe = other(turn)
  if (board[home] === (turn === 'w' ? 'K' : 'k') && !attacked(board, home, foe)) {
    const rook = turn === 'w' ? 'R' : 'r'
    if (s.castling.includes(turn === 'w' ? 'K' : 'k') && board[home + 3] === rook && !board[home + 1] && !board[home + 2] && !attacked(board, home + 1, foe) && !attacked(board, home + 2, foe)) out.push({ from: home, to: home + 2 })
    if (s.castling.includes(turn === 'w' ? 'Q' : 'q') && board[home - 4] === rook && !board[home - 1] && !board[home - 2] && !board[home - 3] && !attacked(board, home - 1, foe) && !attacked(board, home - 2, foe)) out.push({ from: home, to: home - 2 })
  }
  return out
}

/** Make a move without checking it or tracking history. */
function make(s: State, m: Move): State {
  const board = [...s.board]
  const p = board[m.from]
  const kind = p.toLowerCase()
  const captured = board[m.to]
  let ep = -1
  board[m.to] = m.promo ? (s.turn === 'w' ? m.promo.toUpperCase() : m.promo) : p
  board[m.from] = ''
  if (kind === 'p') {
    if (m.to === s.ep && !captured) board[m.to + (s.turn === 'w' ? 8 : -8)] = ''
    if (Math.abs(m.to - m.from) === 16) ep = (m.to + m.from) / 2
  }
  if (kind === 'k' && Math.abs(m.to - m.from) === 2) {
    const rookFrom = m.to > m.from ? m.from + 3 : m.from - 4
    const rookTo = m.to > m.from ? m.from + 1 : m.from - 1
    board[rookTo] = board[rookFrom]
    board[rookFrom] = ''
  }
  let castling = s.castling
  const drop = (c: string) => { castling = castling.replace(c, '') }
  if (kind === 'k') for (const c of s.turn === 'w' ? 'KQ' : 'kq') drop(c)
  for (const sq of [m.from, m.to]) { if (sq === 63) drop('K'); if (sq === 56) drop('Q'); if (sq === 7) drop('k'); if (sq === 0) drop('q') }
  return { board, turn: other(s.turn), castling, ep, half: kind === 'p' || captured ? 0 : s.half + 1, full: s.full + (s.turn === 'b' ? 1 : 0), keys: s.keys }
}

export function legalMoves(s: State): Move[] {
  return pseudoMoves(s).filter((m) => {
    const next = make(s, m)
    return !attacked(next.board, kingSquare(next.board, s.turn), next.turn)
  })
}
export const legalFrom = (s: State, from: number) => legalMoves(s).filter((m) => m.from === from)

const same = (a: Move, b: Move) => a.from === b.from && a.to === b.to && (a.promo ?? '') === (b.promo ?? '')

/** Play a legal move; returns null when it is not legal. */
export function apply(s: State, m: Move): State | null {
  const legal = legalMoves(s).find((x) => same(x, m))
  if (!legal) return null
  const next = make(s, legal)
  const irreversible = next.half === 0
  const withKey = { ...next, keys: irreversible ? [] : [...s.keys] }
  withKey.keys.push(key(withKey))
  return withKey
}
/** Apply for search: no legality check and no history. */
export const applyFast = make

export function status(s: State): Status {
  if (!legalMoves(s).length) return inCheck(s) ? 'checkmate' : 'stalemate'
  if (s.half >= 100) return 'fifty-moves'
  if (s.keys.filter((k) => k === key(s)).length >= 3) return 'repetition'
  if (insufficient(s.board)) return 'material'
  return 'playing'
}

function insufficient(board: string[]): boolean {
  const others = board.map((p, sq) => ({ p, sq })).filter((x) => x.p && x.p.toLowerCase() !== 'k')
  if (!others.length) return true
  if (others.some((x) => 'pqr'.includes(x.p.toLowerCase()))) return false
  if (others.length === 1) return true // a lone bishop or knight cannot mate
  // Only bishops, all on one colour of square.
  return others.every((x) => x.p.toLowerCase() === 'b') && new Set(others.map((x) => (Math.floor(x.sq / 8) + (x.sq % 8)) % 2)).size === 1
}

export function perft(s: State, depth: number): number {
  if (depth === 0) return 1
  const moves = legalMoves(s)
  if (depth === 1) return moves.length
  let n = 0
  for (const m of moves) n += perft(make(s, m), depth - 1)
  return n
}

/** A short readable name for a move in the position before it is played, such as "Nf3", "exd5", "O-O" or "e8=Q+". */
export function describe(s: State, m: Move): string {
  const p = s.board[m.from]
  const kind = p.toLowerCase()
  const capture = !!s.board[m.to] || (kind === 'p' && m.to === s.ep)
  let text: string
  if (kind === 'k' && Math.abs(m.to - m.from) === 2) text = m.to > m.from ? 'O-O' : 'O-O-O'
  else if (kind === 'p') text = `${capture ? FILES[m.from % 8] + 'x' : ''}${squareName(m.to)}${m.promo ? '=' + m.promo.toUpperCase() : ''}`
  else {
    const rivals = legalMoves(s).filter((x) => x.to === m.to && x.from !== m.from && s.board[x.from] === p)
    const dis = rivals.length ? (rivals.every((x) => x.from % 8 !== m.from % 8) ? FILES[m.from % 8] : rivals.every((x) => Math.floor(x.from / 8) !== Math.floor(m.from / 8)) ? String(8 - Math.floor(m.from / 8)) : squareName(m.from)) : ''
    text = `${kind.toUpperCase()}${dis}${capture ? 'x' : ''}${squareName(m.to)}`
  }
  const after = make(s, m)
  if (inCheck(after)) text += legalMoves(after).length ? '+' : '#'
  return text
}
