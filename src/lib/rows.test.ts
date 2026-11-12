import { describe, expect, it } from 'vitest'
import { games } from '../data/games'
import { SHELVES, shelfGames } from './rows'

describe('home shelves', () => {
  it('only name games that exist, with no repeats inside a shelf', () => {
    const ids = new Set(games.map((g) => g.id))
    for (const s of SHELVES) {
      expect(s.ids.every((id) => ids.has(id)), s.id).toBe(true)
      expect(new Set(s.ids).size, s.id).toBe(s.ids.length)
      expect(shelfGames(s, games).length, s.id).toBeGreaterThanOrEqual(4)
    }
  })
  it('keep the shelf order and drop unknown ids', () => {
    expect(shelfGames({ id: 'x', title: 'x', blurb: '', ids: ['poker', 'nope', 'ludo'] }, games).map((g) => g.id)).toEqual(['poker', 'ludo'])
  })
})
