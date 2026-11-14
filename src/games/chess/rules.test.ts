import { describe, expect, it } from 'vitest'
import { apply, describe as name, fromFen, inCheck, legalMoves, newGame, perft, squareName, squareOf, status, toFen, type Move } from './rules'

const mv = (from: string, to: string, promo?: Move['promo']): Move => ({ from: squareOf(from), to: squareOf(to), promo })
const play = (fen: string, ...moves: [string, string, Move['promo']?][]) => moves.reduce((s, [a, b, p]) => { const n = apply(s, mv(a, b, p)); if (!n) throw new Error(`illegal ${a}${b}`); return n }, fromFen(fen))

describe('chess rules', () => {
  it('reads and writes FEN, and names squares', () => {
    expect(toFen(newGame())).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    expect(squareName(0)).toBe('a8')
    expect(squareName(63)).toBe('h1')
    expect(squareOf('e4')).toBe(36)
  })
  // Counts of legal move sequences from published test positions: any bug in castling, en passant, promotion or pins shows up here.
  it('perft: the start position', () => {
    const s = newGame()
    expect([1, 2, 3].map((d) => perft(s, d))).toEqual([20, 400, 8902])
  })
  it('perft: a middlegame with castling and pins (Kiwipete)', () => {
    const s = fromFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1')
    expect([1, 2, 3].map((d) => perft(s, d))).toEqual([48, 2039, 97862])
  })
  it('perft: en passant and discovered checks in an endgame', () => {
    const s = fromFen('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1')
    expect([1, 2, 3, 4].map((d) => perft(s, d))).toEqual([14, 191, 2812, 43238])
  })
  it('perft: promotions and castling through check', () => {
    expect([1, 2, 3].map((d) => perft(fromFen('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1'), d))).toEqual([6, 264, 9467])
    expect([1, 2, 3].map((d) => perft(fromFen('rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8'), d))).toEqual([44, 1486, 62379])
  })
  it('fool\'s mate is checkmate', () => {
    const s = play(START(), ['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4'])
    expect(inCheck(s)).toBe(true)
    expect(status(s)).toBe('checkmate')
    expect(legalMoves(s)).toHaveLength(0)
  })
  it('recognises stalemate', () => {
    expect(status(fromFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'))).toBe('stalemate')
  })
  it('rejects illegal moves: moving into check, jumping, wrong turn', () => {
    const s = newGame()
    expect(apply(s, mv('e2', 'e5'))).toBeNull()
    expect(apply(s, mv('e7', 'e5'))).toBeNull()
    expect(apply(s, mv('a1', 'a3'))).toBeNull()
    const pinned = fromFen('4k3/8/8/8/8/8/4r3/4KR2 w - - 0 1')
    expect(apply(pinned, mv('f1', 'f2'))).toBeNull() // leaves the king in check? f2 is fine for the rook only if the king is safe
  })
  it('castles both ways, and not through or out of check or after the king moved', () => {
    const s = play('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', ['e1', 'g1'])
    expect(toFen(s)).toBe('r3k2r/8/8/8/8/8/8/R4RK1 b kq - 1 1')
    const q = play('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', ['e1', 'c1'])
    expect(toFen(q)).toBe('r3k2r/8/8/8/8/8/8/2KR3R b kq - 1 1')
    const attackedPath = fromFen('r3k2r/8/8/8/8/5r2/8/R3K2R w KQkq - 0 1')
    expect(apply(attackedPath, mv('e1', 'g1'))).toBeNull()
    const inChk = fromFen('r3k2r/8/8/8/8/8/4r3/R3K2R w KQkq - 0 1')
    expect(apply(inChk, mv('e1', 'g1'))).toBeNull()
    const moved = play('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', ['e1', 'e2'], ['a8', 'a7'], ['e2', 'e1'], ['a7', 'a8'])
    expect(apply(moved, mv('e1', 'g1'))).toBeNull()
  })
  it('captures en passant only on the very next move', () => {
    const s = play('4k3/8/8/8/3p4/8/4P3/4K3 w - - 0 1', ['e2', 'e4'])
    const taken = apply(s, mv('d4', 'e3'))!
    expect(taken.board[squareOf('e4')]).toBe('')
    expect(taken.board[squareOf('e3')]).toBe('p')
    const late = play('4k3/8/8/8/3p4/8/4P3/4K3 w - - 0 1', ['e2', 'e4'], ['e8', 'd8'], ['e1', 'd1'])
    expect(apply(late, mv('d4', 'e3'))).toBeNull()
  })
  it('promotes to the chosen piece, and offers all four', () => {
    const s = fromFen('8/P6k/8/8/8/8/8/K7 w - - 0 1')
    expect(legalMoves(s).filter((m) => m.from === squareOf('a7')).map((m) => m.promo).sort()).toEqual(['b', 'n', 'q', 'r'])
    expect(apply(s, mv('a7', 'a8', 'n'))!.board[0]).toBe('N')
  })
  it('draws: bare kings or a lone minor piece, the fifty-move rule, and threefold repetition', () => {
    expect(status(fromFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1'))).toBe('material')
    expect(status(fromFen('4k3/8/8/8/8/8/8/3NK3 w - - 0 1'))).toBe('material')
    expect(status(fromFen('4k3/8/8/8/8/8/8/3QK3 w - - 0 1'))).toBe('playing')
    expect(status(fromFen('4k3/8/8/8/8/8/8/3QK3 w - - 100 80'))).toBe('fifty-moves')
    let s = fromFen('4k3/8/8/8/8/8/8/R3K3 w - - 0 1')
    for (let i = 0; i < 2; i++) s = stepCycle(s)
    expect(status(s)).toBe('repetition')
  })
  it('describes moves in standard notation', () => {
    const s = newGame()
    expect(name(s, mv('g1', 'f3'))).toBe('Nf3')
    expect(name(s, mv('e2', 'e4'))).toBe('e4')
    expect(name(fromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), mv('e1', 'g1'))).toBe('O-O')
    expect(name(fromFen('4k3/8/8/8/8/8/8/R3K2R w - - 0 1'), mv('a1', 'a8'))).toBe('Ra8+')
    expect(name(fromFen('4k3/8/8/R7/8/8/8/R3K3 w - - 0 1'), mv('a5', 'a3'))).toBe('R5a3')
    expect(name(fromFen('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1'), mv('a1', 'a8'))).toBe('Ra8#')
  })
})

function START() { return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' }
/** Shuffle the rook and king back and forth, keeping the position history, to make a position repeat. */
function stepCycle(s: ReturnType<typeof fromFen>) {
  let cur = s
  for (const [a, b] of [['a1', 'a2'], ['e8', 'd8'], ['a2', 'a1'], ['d8', 'e8']]) { const n = apply(cur, mv(a, b)); if (!n) return cur; cur = n }
  return cur
}
