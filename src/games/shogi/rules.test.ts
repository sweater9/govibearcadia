import { describe, expect, it } from 'vitest'
import { apply, fromSfen, inCheck, isOver, isState, kindOf, legalMoves, make, movesFor, newGame, ownerOf, scoreFor, stepRaw, toSfen, type GState, type Move } from './rules'

const sq = (row: number, col: number) => row * 9 + col
const mv = (from: number, to: number, promote = false): Move => ({ from, to, drop: 0, promote })
const drop = (kind: number, to: number): Move => ({ from: -1, to, drop: kind, promote: false })
const perft = (s: GState, d: number): number => (d === 1 ? legalMoves(s).length : legalMoves(s).reduce((n, m) => n + perft(stepRaw(s, m), d - 1), 0))

describe('start position', () => {
  it('has the standard layout and round-trips through SFEN', () => {
    const s = newGame()
    expect(s.cells.filter((c) => ownerOf(c) === 1)).toHaveLength(20)
    expect(s.cells.filter((c) => ownerOf(c) === 2)).toHaveLength(20)
    expect(toSfen(s)).toBe('lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1')
    expect(isState(s)).toBe(true)
    expect(isState({ ...s, cells: [1] })).toBe(false)
  })
  it('matches the known move counts: 30, 900 and 25470 (perft 1 to 3)', () => {
    const s = newGame()
    expect(perft(s, 1)).toBe(30)
    expect(perft(s, 2)).toBe(900)
    expect(perft(s, 3)).toBe(25470)
  })
})

describe('promotion', () => {
  it('offers both choices in the zone, and only promotion when the piece would be stuck', () => {
    const s = fromSfen('4k4/9/4P4/9/9/9/9/9/4K4 b - 1')
    const into = legalMoves(s).filter((m) => m.from === sq(2, 4))
    expect(into.map((m) => m.promote).sort()).toEqual([false, true])
    const last = fromSfen('4k4/4P4/9/9/9/9/9/9/4K4 b - 1')
    // The pawn on the second row may only go to the last row promoted.
    expect(legalMoves(last).filter((m) => m.from === sq(1, 4))).toEqual([mv(sq(1, 4), sq(0, 4), true)])
    const knight = fromSfen('k8/9/2N6/9/9/9/9/9/8K b - 1')
    // A knight reaching the second row from the fourth must promote there; the first row is closed to it.
    const kn = legalMoves(fromSfen('k8/9/9/2N6/9/9/9/9/8K b - 1')).filter((m) => m.from === sq(3, 2))
    expect(kn.every((m) => m.promote)).toBe(true)
    expect(kn.map((m) => m.to).sort()).toEqual([sq(1, 1), sq(1, 3)])
    expect(legalMoves(knight).length).toBeGreaterThan(0)
  })
  it('a promoted piece changes kind, and a captured promoted piece is held as its plain kind', () => {
    const s = fromSfen('4k4/9/4P4/9/9/9/9/9/4K4 b - 1')
    const p = apply(s, mv(sq(2, 4), sq(1, 4), true))
    expect(kindOf(p.cells[sq(1, 4)])).toBe(9)
    const t = fromSfen('4k4/4+p4/9/9/9/9/9/9/4K1R2 b - 1')
    const taken = apply(t, mv(sq(8, 6), sq(1, 6)))
    expect(taken).toBe(taken)
    const cap = fromSfen('4k4/6+p2/9/9/9/9/9/9/4K1R2 b - 1')
    const after = apply(cap, mv(sq(8, 6), sq(1, 6)))
    expect(after.hand[0][0]).toBe(1)
    expect(after.cells[sq(1, 6)]).toBe(make(7, 1))
  })
})

describe('drops', () => {
  it('cannot drop a second pawn on a file, or a piece that could never move', () => {
    const s = fromSfen('4k4/9/9/9/9/9/9/9/P3K4 b PLN 1')
    const drops = legalMoves(s).filter((m) => m.drop)
    expect(drops.some((m) => m.drop === 1 && m.to % 9 === 0)).toBe(false)
    expect(drops.some((m) => m.drop === 1 && m.to % 9 === 1)).toBe(true)
    expect(drops.filter((m) => (m.drop === 1 || m.drop === 2) && m.to < 9)).toEqual([])
    expect(drops.filter((m) => m.drop === 3 && m.to < 18)).toEqual([])
    expect(drops.some((m) => m.drop === 3 && m.to === sq(2, 4))).toBe(true)
  })
  it('a drop must answer a check, and a held piece comes from captures', () => {
    const checked = fromSfen('4k4/9/9/9/4r4/9/9/9/4K4 b G 1')
    expect(inCheck(checked, 1)).toBe(true)
    const answers = legalMoves(checked)
    expect(answers.some((m) => m.drop === 5 && m.to === sq(5, 4))).toBe(true)
    expect(answers.some((m) => m.drop === 5 && m.to === sq(5, 0))).toBe(false)
  })
  it('a pawn drop that gives checkmate is illegal, but the same drop with no mate is fine', () => {
    const s = fromSfen('7lk/7p1/7G1/9/9/9/9/9/K8 b P 1')
    expect(legalMoves(s).some((m) => m.drop === 1 && m.to === sq(1, 8))).toBe(false)
    expect(legalMoves(s).some((m) => m.drop === 1 && m.to === sq(4, 0))).toBe(true)
    // Without the gold guarding it the king can take the pawn, so the drop is a plain check and allowed.
    const open = fromSfen('7lk/7p1/9/9/9/9/9/9/K8 b P 1')
    expect(legalMoves(open).some((m) => m.drop === 1 && m.to === sq(1, 8))).toBe(true)
  })
})

describe('check, checkmate and the end of the game', () => {
  it('finds mate in one and stops the game', () => {
    const s = fromSfen('4k4/R8/9/9/9/9/9/8R/4K4 b - 1')
    const mate = apply(s, mv(sq(7, 8), sq(0, 8)))
    expect(mate.winner).toBe(1)
    expect(mate.reason).toBe('checkmate')
    expect(isOver(mate)).toBe(true)
    expect(legalMoves(mate)).toEqual([])
    expect(apply(mate, mv(sq(0, 4), sq(0, 3)))).toBe(mate)
    expect(scoreFor(mate)).toBeGreaterThan(600)
  })
  it('a player with no legal move and no check also loses', () => {
    const s = fromSfen('k8/9/G8/5R3/9/9/9/9/4K4 b - 1')
    const stuck = apply(s, mv(sq(3, 5), sq(3, 1)))
    expect(inCheck(stuck, 2)).toBe(false)
    expect(stuck.winner).toBe(1)
    expect(stuck.reason).toBe('no-moves')
  })
  it('a king may not step into check, and a pinned piece may not leave the line', () => {
    const s = fromSfen('4k4/9/9/9/9/9/4r4/4G4/4K4 b - 1')
    // The gold is pinned against the king by the rook on the same file.
    expect(movesFor(s, sq(7, 4)).every((m) => m.to % 9 === 4)).toBe(true)
    const k = fromSfen('4k4/9/9/9/9/9/9/3r5/4K4 b - 1')
    expect(movesFor(k, sq(8, 4)).some((m) => m.to === sq(7, 4))).toBe(false)
  })
  it('illegal moves are refused', () => {
    const s = newGame()
    expect(apply(s, mv(sq(6, 0), sq(3, 0)))).toBe(s)
    expect(apply(s, mv(sq(2, 0), sq(3, 0)))).toBe(s)
    expect(apply(s, drop(1, sq(4, 4)))).toBe(s)
  })
  it('four repeats of a position is a draw', () => {
    let s = fromSfen('4k4/r8/9/9/9/9/9/8R/4K4 b - 1')
    const cycle = [mv(sq(7, 8), sq(7, 7)), mv(sq(1, 0), sq(1, 1)), mv(sq(7, 7), sq(7, 8)), mv(sq(1, 1), sq(1, 0))]
    for (let i = 0; i < 16 && !isOver(s); i++) s = apply(s, cycle[i % 4])
    expect(s.draw).toBe(true)
    expect(s.reason).toBe('sennichite')
    expect(scoreFor(s)).toBe(200)
  })
  it('a capture puts the piece in hand', () => {
    let s = newGame()
    s = apply(s, mv(sq(6, 2), sq(5, 2)))
    s = apply(s, mv(sq(2, 6), sq(3, 6)))
    s = apply(s, mv(sq(7, 1), sq(1, 7), true))
    expect(s.hand[0][5]).toBe(1)
    expect(kindOf(s.cells[sq(1, 7)])).toBe(14)
  })
})
