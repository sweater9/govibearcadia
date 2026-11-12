import { describe, expect, it } from 'vitest'
import { BLACKJACK_TABLES, POKER_TABLES, bestTable, blackjackTable, pokerTable, unlocked } from './tables'

describe('tables', () => {
  it('get harder: higher requirement, higher stakes', () => {
    for (const list of [BLACKJACK_TABLES, POKER_TABLES]) for (let i = 1; i < list.length; i++) expect(list[i].needs).toBeGreaterThan(list[i - 1].needs)
    for (let i = 1; i < BLACKJACK_TABLES.length; i++) expect(BLACKJACK_TABLES[i].max).toBeGreaterThan(BLACKJACK_TABLES[i - 1].max)
  })
  it('you can always cover a poker buy-in at a table you can sit at', () => {
    expect(POKER_TABLES.every((t) => t.needs >= t.buyIn || t.needs === 0)).toBe(true)
  })
  it('every blackjack chip fits the table limits', () => {
    for (const t of BLACKJACK_TABLES) expect(t.chips.every((c) => c >= t.min && c <= t.max)).toBe(true)
  })
  it('picks the hardest table you qualify for, and falls back safely', () => {
    expect(bestTable(BLACKJACK_TABLES, 100).id).toBe('rookie')
    expect(bestTable(BLACKJACK_TABLES, 1000).id).toBe('regular')
    expect(bestTable(BLACKJACK_TABLES, 9000).id).toBe('high')
    expect(unlocked(POKER_TABLES[1], 749)).toBe(false)
    expect(blackjackTable('nope').id).toBe('regular')
    expect(pokerTable(undefined).id).toBe('rookie')
  })
})
