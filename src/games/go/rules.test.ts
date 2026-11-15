import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { KOMI, aiChoose, aiPlay, groupAt, isLegal, isOver, isOwnEye, isState, margin, moveCap, newGame, pass, play, scoreArea, scoreFor, tryMove, winner, type Color, type GState, type Size } from './rules'

/** Builds a position from rows of '.', 'X' (black) and 'O' (white), placed in the top-left corner. */
function board(rows: string[], turn: Color = 1, size: Size = 9): GState {
  const cells = Array<number>(size * size).fill(0)
  rows.forEach((row, y) => [...row].forEach((ch, x) => (cells[y * size + x] = ch === 'X' ? 1 : ch === 'O' ? 2 : 0)))
  return { ...newGame(size), cells, turn, seen: [cells.join('')] }
}
const at = (x: number, y: number, size = 9) => y * size + x

describe('captures and liberties', () => {
  it('counts a group and its liberties', () => {
    const s = board(['XX.', 'X..'])
    const g = groupAt(s.cells, 9, at(0, 0))
    expect(g.stones.sort()).toEqual([at(0, 0), at(1, 0), at(0, 1)].sort())
    expect(g.liberties.length).toBe(3)
  })
  it('captures a stone in the corner and counts it', () => {
    const s = board(['O.', 'X.'], 1)
    const r = play(s, at(1, 0))
    expect(r.cells[at(0, 0)]).toBe(0)
    expect(r.captures).toEqual([1, 0])
    expect(r.turn).toBe(2)
  })
  it('removes a multi-stone group when its last liberty is filled, and not before', () => {
    const open = board(['XO.', 'XO.', '.X.'], 1)
    const early = play(open, at(1, 2))
    expect(early.cells[at(1, 1)]).toBe(2)
    expect(early.captures[0]).toBe(0)
    const shut = board(['XOX', 'XOX', '...'], 1)
    const r = play(shut, at(1, 2))
    expect(r.cells[at(1, 0)]).toBe(0)
    expect(r.cells[at(1, 1)]).toBe(0)
    expect(r.captures[0]).toBe(2)
  })
})

describe('suicide and occupied points', () => {
  it('refuses a move that would leave your own stone with no liberty', () => {
    const s = board(['.O', 'O.'], 1)
    expect(play(s, at(0, 0))).toBe(s)
    expect(tryMove(s.cells, 9, at(0, 0), 1)).toBeNull()
  })
  it('allows a move into no liberties when it captures', () => {
    const s = board(['.OX', 'OXX', 'XX.'], 1)
    // Black at (0,0): neighbours (1,0)=O and (0,1)=O. White (1,0) has liberties? neighbours (0,0),(2,0)=X,(1,1)=X: only (0,0). Captured.
    const r = play(s, at(0, 0))
    expect(r).not.toBe(s)
    expect(r.cells[at(1, 0)]).toBe(0)
  })
  it('refuses an occupied or off-board point', () => {
    const s = board(['X'])
    expect(play(s, at(0, 0))).toBe(s)
    expect(play(s, -1)).toBe(s)
    expect(play(s, 81)).toBe(s)
    expect(play(s, 1.5)).toBe(s)
    expect(isLegal(s, at(5, 5))).toBe(true)
  })
})

describe('ko', () => {
  // . X O .
  // X O . O
  // . X O .
  const ko = () => board(['.XO.', 'XO.O', '.XO.'], 1)
  it('forbids retaking a ko immediately, but allows it after the board has changed', () => {
    const s = ko()
    const a = play(s, at(2, 1))
    expect(a.cells[at(1, 1)]).toBe(0)
    expect(a.captures[0]).toBe(1)
    const retake = play(a, at(1, 1))
    expect(retake).toBe(a)
    // A move elsewhere by white, one by black, and the recapture is a new position.
    const w = play(a, at(7, 7))
    const b = play(w, at(7, 6))
    const again = play(b, at(1, 1))
    expect(again).not.toBe(b)
    expect(again.cells[at(2, 1)]).toBe(0)
  })
})

describe('passing and the end', () => {
  it('two passes in a row end the game, a move in between resets the count', () => {
    let s = newGame()
    s = pass(s)
    expect(s.passes).toBe(1)
    expect(isOver(s)).toBe(false)
    s = play(s, at(4, 4))
    expect(s.passes).toBe(0)
    s = pass(pass(s))
    expect(isOver(s)).toBe(true)
    expect(pass(s)).toBe(s)
    expect(play(s, at(0, 0))).toBe(s)
  })
  it('calls a game that runs past the move cap', () => {
    const s = { ...newGame(), moves: moveCap(9) - 1 }
    expect(isOver(play(s, at(4, 4)))).toBe(true)
  })
})

describe('area scoring', () => {
  it('counts stones and the territory only one colour borders, with komi', () => {
    const rows = Array.from({ length: 9 }, () => '...X.O...')
    const s = board(rows, 1)
    const a = scoreArea(s.cells, 9)
    expect(a.blackStones).toBe(9)
    expect(a.blackTerritory).toBe(27)
    expect(a.whiteTerritory).toBe(27)
    expect(a.neutral).toBe(9)
    expect(a.black).toBe(36)
    expect(a.white).toBe(36)
    expect(margin(s)).toBe(-KOMI)
    expect(winner(s)).toBe(2)
    expect(scoreFor(s)).toBeLessThan(400)
  })
  it('an empty board is white by komi, and a big black win scores well', () => {
    expect(winner(newGame())).toBe(2)
    const s = board(Array.from({ length: 9 }, () => 'XXXXXXXXX'))
    expect(winner(s)).toBe(1)
    expect(scoreFor(s)).toBeGreaterThan(400)
    expect(scoreFor({ ...s, size: 9 })).toBe(400 + 15 * Math.round(81 - KOMI))
  })
  it('validates state', () => {
    expect(isState(newGame(13))).toBe(true)
    expect(isState({ ...newGame(), size: 7 })).toBe(false)
    expect(isState(null)).toBe(false)
  })
})

describe('computer', () => {
  it('knows an eye from an open point', () => {
    const s = board(['OOO', 'O.O', 'OOO'], 2)
    expect(isOwnEye(s.cells, 9, at(1, 1), 2)).toBe(true)
    expect(isOwnEye(s.cells, 9, at(1, 1), 1)).toBe(false)
    const open = board(['.O.', 'O.O', '.O.'], 2)
    expect(isOwnEye(open.cells, 9, at(1, 1), 2)).toBe(false)
  })
  it('captures a stone in atari at Normal, never fills its own eye, and passes back when ahead', () => {
    const grab = board(['XO', '..'], 2)
    expect(aiChoose(grab, createRandom('a'), 'normal')).toBe(at(0, 1))
    const eye = board(['OOO.', 'O.O.', 'OOO.'], 2)
    for (let i = 0; i < 10; i++) expect(aiChoose(eye, createRandom(`e${i}`), 'normal')).not.toBe(at(1, 1))
    const passed = pass(newGame())
    expect(aiChoose(passed, createRandom('p'), 'normal')).toBe('pass')
  })
  it('plays a legal move at every level, and the same one for the same seed', () => {
    const s = board(['..X.', '.OX.', '..X.'], 2)
    for (const level of ['easy', 'normal', 'hard'] as const) {
      const a = aiChoose(s, createRandom('lvl'), level)
      expect(a).toBe(aiChoose(s, createRandom('lvl'), level))
      if (a !== 'pass') expect(isLegal(s, a)).toBe(true)
    }
  })
  it('Hard answers a 13x13 position quickly', () => {
    let s = newGame(13)
    const r = createRandom('h13')
    for (let i = 0; i < 6; i++) s = aiPlay(s, r, 'normal')
    const t0 = Date.now()
    const c = aiChoose(s, createRandom('hard'), 'hard')
    expect(Date.now() - t0).toBeLessThan(4000)
    if (c !== 'pass') expect(isLegal(s, c)).toBe(true)
  })
  it('two Normal computers play a 9x9 game to the end, legally and the same way twice', () => {
    const run = () => {
      let s = newGame(9)
      const r = createRandom('aa')
      for (let i = 0; i < 400 && !isOver(s); i++) s = aiPlay(s, r, 'normal')
      return s
    }
    const a = run()
    expect(isOver(a)).toBe(true)
    expect(run()).toEqual(a)
    expect(scoreArea(a.cells, 9).black + scoreArea(a.cells, 9).white).toBeGreaterThan(0)
  })
})
