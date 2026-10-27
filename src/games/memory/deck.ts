import { shuffle, type Random } from '../../lib/rng'

export const SYMBOLS = ['◆', '✦', '●', '▲', '☾', '⬡'] as const

export type Card = { id: number; symbol: string }

/** Pure rules for Memory Grid: no React, no browser APIs, so a server can reuse them. */
export const makeDeck = (random: Random): Card[] =>
  shuffle([...SYMBOLS, ...SYMBOLS].map((symbol, id) => ({ id, symbol })), random)

export const scoreFor = (moves: number): number => Math.max(100, 1200 - moves * 40)
