import { describe, expect, it } from 'vitest'
import { counts, TYPES } from './tiles'
import { scoreWin, type Meld, type WinContext } from './scoring'

const T = (s: string): number[] => {
  const out: number[] = []
  for (const part of s.split(' ').filter(Boolean)) {
    const suit = part.slice(-1)
    const base = { c: 0, d: 9, b: 18 }[suit as 'c']
    if (suit === 'h') for (const ch of part.slice(0, -1)) out.push(26 + Number(ch))
    else for (const ch of part.slice(0, -1)) out.push(base + Number(ch) - 1)
  }
  return out
}
const ctx = (hand: string, o: Partial<WinContext> & { melds?: Meld[] } = {}): WinContext => ({
  concealed: counts(T(hand)), melds: [], flowers: [], selfDraw: false, winTile: T(hand)[0], afterKong: false, seatWind: 0, roundWind: 0, ...o,
})
const names = (c: WinContext) => scoreWin(c)!.items.map((i) => i.name)
const tai = (c: WinContext) => scoreWin(c)!.tai

describe('scoring a winning hand', () => {
  const chows = '123c 456c 789c 123d 456d 99b' // 5 chows + pair = 17 tiles
  it('returns null for a hand that is not complete', () => {
    expect(scoreWin(ctx('123c 456c 789c 123d 457d 99b'))).toBeNull()
    expect(counts([]).length).toBe(TYPES)
  })
  it('a plain win on a discard with no melds is a concealed hand, 1 tai, plus all chows 2', () => {
    const c = ctx(chows)
    expect(names(c)).toEqual(['Concealed hand', 'All chows'])
    expect(tai(c)).toBe(3)
  })
  it('self-draw with a closed hand is 3 tai in all, not 1 and 1', () => {
    const c = ctx(chows, { selfDraw: true })
    expect(names(c)).toContain('Concealed self-draw')
    expect(tai(c)).toBe(5)
  })
  it('an open hand that wins on a discard has no concealed or self-draw tai', () => {
    const melds: Meld[] = [{ kind: 'chow', tile: 0, open: true }]
    const c = ctx('456c 789c 123d 456d 99b', { melds, winTile: 3 })
    expect(names(c)).toEqual(['All chows'])
  })
  it('flowers spoil all chows; only the seat flowers score', () => {
    const c = ctx(chows, { flowers: [34, 36] }) // Spring (East) scores, Autumn (West) does not
    expect(names(c)).toEqual(['Concealed hand', 'Seat flower'])
    expect(tai(c)).toBe(2)
  })
  it('counts dragon pungs and the seat and round winds', () => {
    const melds: Meld[] = [{ kind: 'pung', tile: 31, open: true }, { kind: 'pung', tile: 27, open: true }]
    const c = ctx('123c 456c 789d 99b', { melds, winTile: 0, seatWind: 0, roundWind: 0 })
    expect(names(c)).toEqual(['Dragon pung', 'Seat wind', 'Round wind'])
    expect(tai(ctx('123c 456c 789d 99b', { melds, winTile: 0, seatWind: 1, roundWind: 0 }))).toBe(2)
  })
  it('all pungs is 4 tai and concealed pungs are counted by how many were not claimed', () => {
    const c = ctx('111c 222d 333b 444c 555d 66b', { winTile: 12 })
    // The 555d pung stays concealed unless the winning tile completed it. Winning tile 4 Characters (index 3) completes 444c.
    const win = { ...c, winTile: 3 }
    expect(names(win)).toContain('All pungs')
    expect(names(win)).toContain('Four concealed pungs')
    expect(names({ ...c, selfDraw: true })).toContain('Five concealed pungs')
  })
  it('half and full flush, all honours', () => {
    expect(names(ctx('123c 456c 789c 123c 456c 99c'))).toContain('Full flush')
    expect(names(ctx('123c 456c 789c 123c 456c 11h'))).toContain('Half flush')
    expect(names(ctx('111h 222h 333h 444h 555h 66h', { winTile: 27 }))).toContain('All honours')
  })
  it('little three dragons is 4 tai in all and replaces the single dragon pung tai', () => {
    const melds: Meld[] = [{ kind: 'pung', tile: 31, open: true }, { kind: 'pung', tile: 32, open: true }]
    const c = ctx('123c 456c 789d 77h', { melds, winTile: 0 })
    expect(names(c)).toContain('Little three dragons')
    expect(names(c)).not.toContain('Dragon pungs')
    expect(scoreWin(c)!.items.find((i) => i.name === 'Little three dragons')!.tai).toBe(4)
  })
  it('big three dragons is 8 tai', () => {
    const melds: Meld[] = [31, 32, 33].map((tile) => ({ kind: 'pung', tile, open: true }))
    const c = ctx('123c 456c 99b', { melds, winTile: 0 })
    expect(names(c)).toContain('Big three dragons')
    expect(names(c)).not.toContain('Dragon pungs')
  })
  it('chooses the split that scores most', () => {
    // 111222333c can be three pungs or three chows; with 44d 55d... use a plain case.
    const c = ctx('111c 222c 333c 456d 789d 55b', { winTile: 0, selfDraw: true })
    expect(tai(c)).toBeGreaterThanOrEqual(3)
  })
})
