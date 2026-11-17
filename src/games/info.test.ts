import { describe, expect, it } from 'vitest'
import { games } from '../data/games'
import { GAME_INFO } from './info'

describe('game instructions', () => {
  it('every game has instructions, and there are none for games that do not exist', () => {
    const ids = games.map((g) => g.id)
    expect(ids.filter((id) => !GAME_INFO[id])).toEqual([])
    expect(Object.keys(GAME_INFO).filter((id) => !ids.includes(id))).toEqual([])
  })
  it('each entry is a real sentence, not a placeholder', () => {
    for (const [id, i] of Object.entries(GAME_INFO)) {
      expect(i.how.length, id).toBeGreaterThan(40)
      expect(i.how, id).toMatch(/[.]$/)
      if (i.controls) expect(i.controls, id).toMatch(/[.]$/)
    }
  })
})
