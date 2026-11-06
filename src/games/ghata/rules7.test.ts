import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { chooseAction } from './bot'
import {
  LAYOUTS, apply, cellOf, invariantErrors, isSafe, keyOf, legalActions, newGame as freshGame, planJuga, planPawn,
  type Action, type Juga, type Seat, type State, type Where,
} from './rules'

/** Most scenarios below were written when seat 0 sat at the top. Player 1 now sits at the bottom, so the old top seat is seat 2: pawn ids 0-5 belong to GEO[0], and so on (geometry-equivalent). */
const GEO = [2, 3, 0, 1] as const
const newGame = (...a: Parameters<typeof freshGame>): State => {
  const s = freshGame(...a)
  for (const p of s.pawns) p.seat = GEO[p.seat]
  s.turn = GEO[0]
  return s
}

// The 7x7 board from the owner's cloth and drawing. Squares are `o<n>` (outer ring, counterclockwise from the top middle,
// 24 squares), `i<n>` (interior: i0..i15 the middle ring clockwise from just under the top middle, i16..i23 the inner ring) and `c`.
const L = LAYOUTS[7]
const at7 = (seat: Seat, key: string): number => {
  const n = Number(key.slice(1))
  if (key[0] === 'o') return (n - L.start[seat] + 24) % 24
  for (let a = 0; a < 24; a++) if (L.interiorId(seat, a) === n) return a
  throw new Error(`no such interior square ${key} for seat ${seat}`)
}
const idAt = (r: number, c: number) => `i${L.interiorCells.findIndex(([rr, cc]) => rr === r && cc === c)}`
const outerAt = (r: number, c: number) => `o${L.outerCells.findIndex(([rr, cc]) => rr === r && cc === c)}`

function put(s: State, id: number, where: Where, key: string | number, credit = true) {
  const p = s.pawns[id]
  p.where = where
  p.at = typeof key === 'number' ? key : at7(p.seat, key)
  p.credit = credit
}
function juga(s: State, seat: Seat, key: string, ids: [number, number]): Juga {
  const j: Juga = { id: s.nextJuga++, seat, at: at7(seat, key), pawns: ids, pinned: null }
  for (const id of ids) put(s, id, 'juga', j.at)
  s.jugas.push(j)
  return j
}
function moving(seat: Seat, queue: number[]): State {
  const s = newGame(7)
  s.turn = seat
  s.phase = 'move'
  s.queue = queue
  s.entered = [true, true, true, true]
  return s
}
const ok = (s: State, a: Action): State => {
  const r = apply(s, a)
  if (!r.ok) throw new Error(`rejected: ${r.error}`)
  return r.state
}
const pawnMove = (id: number, chunks: number[]): Action => ({ type: 'move', kind: 'pawn', id, chunks })
const jugaMove = (id: number, chunks: number[]): Action => ({ type: 'move', kind: 'juga', id, chunks })

describe('7x7 geometry', () => {
  it('has 24 outer squares, 16 middle, 8 inner and one Home: 49 squares in all', () => {
    expect(L.outerCells).toHaveLength(24)
    expect(L.interiorCells).toHaveLength(24)
    const all = new Set([...L.outerCells, ...L.interiorCells, L.centre].map(([r, c]) => `${r},${c}`))
    expect(all.size).toBe(49)
  })
  it('the starts are the middles of the four edges: bottom (player 1), right, top, left', () => {
    expect(L.start.map((i) => L.outerCells[i])).toEqual([[6, 3], [3, 6], [0, 3], [3, 0]])
  })
  it('the outer ring runs counterclockwise: left along the top, down the left side, right along the bottom, up the right side', () => {
    const [a, b] = [L.outerCells[1], L.outerCells[2]]
    expect([a, b]).toEqual([[0, 2], [0, 1]])
    expect(L.outerCells[4]).toEqual([1, 0])
    expect(L.outerCells[10]).toEqual([6, 1])
    expect(L.outerCells[16]).toEqual([5, 6])
    expect(L.outerCells[21]).toEqual([0, 6])
    expect(L.outerCells[23]).toEqual([0, 4])
  })
  it('exactly the 13 squares of the cloth are safe: four corners, four edge middles, the centre and the four squares inside the corners', () => {
    const safeCells = [...L.safe].map((k) => cellOf(k, 7).join(',')).sort()
    expect(safeCells).toEqual(['0,0', '0,3', '0,6', '1,1', '1,5', '3,0', '3,3', '3,6', '5,1', '5,5', '6,0', '6,3', '6,6'])
    expect(isSafe('c', 7)).toBe(true)
    expect(isSafe(outerAt(0, 1), 7)).toBe(false)
  })
  it('each seat walks the same interior path turned to face its own start: in beside its turn square, clockwise, 24 squares, then Home', () => {
    const expectEntry: [number, number][] = [[5, 1], [5, 5], [1, 5], [1, 1]]
    for (const seat of [0, 1, 2, 3] as const) {
      const cells = Array.from({ length: 24 }, (_, a) => cellOf(`i${L.interiorId(seat, a)}`, 7))
      expect(new Set(cells.map((c) => c.join(','))).size).toBe(24)
      expect(cells[0]).toEqual(expectEntry[seat])
      const [tr, tc] = L.outerCells[(L.start[seat] + L.turnAt) % L.outerLen]
      expect(Math.abs(cells[0][0] - tr) + Math.abs(cells[0][1] - tc)).toBe(1) // directly beside the turn square
      for (let a = 1; a < 24; a++) expect(Math.abs(cells[a][0] - cells[a - 1][0]) + Math.abs(cells[a][1] - cells[a - 1][1])).toBe(1)
      const [lr, lc] = cells[23]
      expect(Math.abs(lr - 3) + Math.abs(lc - 3)).toBe(1) // the last square touches Home
    }
  })
  it("follows the owner's arrows for the bottom seat: up the middle ring's left side, along its top, down its right, back along its bottom, then the inner ring from its bottom-left corner", () => {
    const c = (a: number) => cellOf(`i${L.interiorId(0, a)}`, 7)
    expect([c(0), c(1), c(4), c(5), c(8), c(9), c(12), c(13), c(15)]).toEqual([[5, 1], [4, 1], [1, 1], [1, 2], [1, 5], [2, 5], [5, 5], [5, 4], [5, 2]])
    expect([c(16), c(17), c(18), c(19), c(20), c(21), c(22), c(23)]).toEqual([[4, 2], [3, 2], [2, 2], [2, 3], [2, 4], [3, 4], [4, 4], [4, 3]])
  })
})

describe('7x7 turning inward', () => {
  it('the turn square is two before the start square, and a pawn with no capture goes past it and past its start, round again', () => {
    expect(L.turnAt).toBe(22)
    const s = moving(GEO[0], [3])
    put(s, 0, 'outer', 22, false)
    const after = ok(s, pawnMove(0, [0]))
    expect(after.pawns[0]).toMatchObject({ where: 'outer', at: 1 }) // 22 -> 23 -> 0 (start) -> 1
  })
  it('a pawn with a capture turns inward from the turn square, without stepping back onto its start square', () => {
    const s = moving(GEO[0], [1])
    put(s, 0, 'outer', 22, true)
    const after = ok(s, pawnMove(0, [0]))
    expect(after.pawns[0]).toMatchObject({ where: 'inner', at: 0 })
    expect(cellOf(keyOf(GEO[0], 'inner', 0, 7)!, 7)).toEqual([1, 5])
  })
  it('it does not turn before the turn square, even one step short of it', () => {
    const s = moving(GEO[0], [1])
    put(s, 0, 'outer', 21, true)
    expect(planPawn(s, s.pawns[0], 1)!.end).toEqual({ where: 'outer', at: 22 })
  })
  it('a pawn that starts on its own start square needs 22 steps, then one more to enter the middle ring', () => {
    const s = moving(GEO[0], [6, 6, 6, 4, 1])
    put(s, 0, 'outer', 0, true)
    expect(planPawn(s, s.pawns[0], 22)!.end).toEqual({ where: 'outer', at: 22 })
    expect(planPawn(s, s.pawns[0], 23)!.end).toEqual({ where: 'inner', at: 0 })
  })
  it('it does not turn in half way round, however close it passes to the middle', () => {
    const s = moving(GEO[0], [9])
    put(s, 0, 'outer', 4, true)
    expect(planPawn(s, s.pawns[0], 9)!.end).toEqual({ where: 'outer', at: 13 })
  })
  it('every seat turns in from the square two before its own start', () => {
    for (const [seat, cell] of [[1, [1, 1]], [2, [5, 1]], [3, [5, 5]]] as const) {
      const s = moving(GEO[seat], [1])
      put(s, seat * 6, 'outer', 22, true)
      const after = ok(s, pawnMove(seat * 6, [0]))
      expect(after.pawns[seat * 6].where).toBe('inner')
      expect(cellOf(keyOf(GEO[seat], 'inner', after.pawns[seat * 6].at, 7)!, 7)).toEqual(cell)
    }
  })
  it('a pawn walks 24 interior squares, then needs the exact count into Home', () => {
    const s = moving(GEO[0], [2, 1])
    put(s, 0, 'inner', 22, true) // the second to last square
    expect(planPawn(s, s.pawns[0], 3)).toBeNull() // would overshoot Home
    const after = ok(s, pawnMove(0, [0])) // 22 -> 23 -> Home
    expect(after.pawns[0].where).toBe('home')
  })
  it('the corner and diagonal X squares are safe: no captures, opposing pawns coexist', () => {
    const s = moving(GEO[0], [3])
    put(s, 0, 'outer', 0, false) // top middle
    put(s, 6, 'outer', outerAt(0, 0), false) // seat 1 stands on the top-left corner
    s.pawns[6].at = at7(GEO[1], outerAt(0, 0))
    const plan = planPawn(s, s.pawns[0], 3)!
    expect(plan.capture).toEqual([])
    expect(keyOf(GEO[0], 'outer', 3, 7)).toBe(outerAt(0, 0))
  })
})

describe('7x7 Jugas', () => {
  it('a Juga moves at half speed along the 24-square interior path and needs an exact even count into Home', () => {
    const s = moving(GEO[0], [6])
    const j = juga(s, GEO[0], idAt(5, 5), [0, 1]) // interior step 4: the middle ring's bottom-right corner (top seat)
    expect(j.at).toBe(4)
    expect(planJuga(s, j, 6)).toMatchObject({ to: 7 })
    const near = juga(moving(GEO[0], [6]), GEO[0], idAt(2, 3), [0, 1]) // the last square, 1 from Home
    expect(near.at).toBe(23)
    const t = moving(GEO[0], [2, 4])
    const k = juga(t, GEO[0], idAt(2, 3), [0, 1])
    expect(planJuga(t, k, 4)).toBeNull()
    expect(ok(t, jugaMove(k.id, [0])).pawns[0].where).toBe('home')
  })
  it('pins, blockades and captures work on the middle ring too', () => {
    const s = moving(GEO[0], [2])
    const j = juga(s, GEO[0], idAt(1, 5), [0, 1])
    put(s, 12, 'inner', idAt(2, 5), true)
    s.pawns[12].seat = GEO[2]
    s.pawns[12].at = at7(GEO[2], idAt(2, 5))
    const after = ok(s, jugaMove(j.id, [0]))
    expect(after.jugas[0].at).toBe(1)
    expect(after.jugas[0].pinned).toBe(12)
    expect(invariantErrors(after)).toEqual([])
  })
})

describe('7x7 whole games', () => {
  it('computer players finish full four-player games and the rules hold after every action', () => {
    for (let seed = 0; seed < 4; seed++) {
      const random = createRandom(`seven-${seed}`)
      let s = newGame(7)
      let steps = 0
      while (s.phase !== 'over' && steps < 120_000) {
        const result = apply(s, chooseAction(s, random))
        if (!result.ok) throw new Error(`bot made an illegal move: ${result.error}`)
        s = result.state
        expect(invariantErrors(s), `seed ${seed} step ${steps}`).toEqual([])
        steps++
      }
      expect(s.phase, `seed ${seed} did not finish`).toBe('over')
      expect(s.pawns.filter((p) => p.seat === s.winner).every((p) => p.where === 'home')).toBe(true)
    }
  }, 120_000)
  it('never offers a move the engine would reject', () => {
    const random = createRandom('seven-legal')
    let s = newGame(7)
    for (let i = 0; i < 4000 && s.phase !== 'over'; i++) {
      for (const a of legalActions(s)) expect(apply(s, a).ok).toBe(true)
      s = ok(s, chooseAction(s, random))
    }
  })
})
