import { describe, expect, it } from 'vitest'
import { readCatalog } from '../../e2e/catalog'
import { registry } from './registry'

/** Every game ID that existed when the catalogue became one-file-per-game, in display order. IDs and routes never change. */
const SHIPPED_IDS = [
  'neon-merge', 'memory-grid', 'pulse-tap', 'minesweeper', 'neon-snake', 'color-sort', 'connect-four', 'tic-tac-toe', 'checkers', 'battleship',
  'daily-word', 'brick-breaker', 'neon-pong', 'nonogram', 'traffic-dodger', 'stack-tower', 'lane-hopper', 'mole-mash', 'sudoku-master', 'space-defender',
  'gravity-flip', 'vibeline', 'twofold', 'carve', 'ghata-bara', 'aadu-puli-attam', 'pallanguzhi', 'carrom', 'taiwanese-mahjong', 'world-trip',
  'ludo', 'indian-rummy', 'klondike', 'call-break', 'chess', 'blackjack', 'poker',
]

describe('game catalogue', () => {
  const ids = registry.map((e) => e.meta.id)

  it('keeps every shipped game ID, and only adds games after them', () => {
    for (const id of SHIPPED_IDS) expect(ids, `${id} is still registered`).toContain(id)
    expect(ids.slice(0, SHIPPED_IDS.length).sort()).toEqual([...SHIPPED_IDS].sort())
  })
  it('has unique IDs and unique order numbers', () => {
    expect(new Set(ids).size).toBe(ids.length)
    const orders = readCatalog().map((r) => r.order)
    expect(new Set(orders).size).toBe(orders.length)
  })
  it('is read the same way by the registry and by the e2e suite', () => {
    const rows = readCatalog()
    expect(rows.map((r) => [r.id, r.title, r.category])).toEqual(registry.map((e) => [e.meta.id, e.meta.title, e.meta.category]))
  })
  it('gives every game a play area to check', () => {
    for (const row of readCatalog()) expect(row.playArea, row.id).toMatch(/^[.#a-z]/i)
  })
})
