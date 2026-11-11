/**
 * Play-money coins. Pure rules, no browser APIs. Coins are never bought with money and have no cash value.
 * Earnings are derived from the play history (so they follow a backup and apply to past runs); only what was bought is stored.
 */
import type { PlayRecord } from '../types'

export const COINS_PER_PLAY = 5
export const COINS_WIN_BONUS = 15
export const COINS_DAILY_BONUS = 50

export function coinsFor(record: Pick<PlayRecord, 'won' | 'daily'>): number {
  return COINS_PER_PLAY + (record.won ? COINS_WIN_BONUS : 0) + (record.won && record.daily ? COINS_DAILY_BONUS : 0)
}
export const coinsEarned = (history: readonly Pick<PlayRecord, 'won' | 'daily'>[]): number => history.reduce((n, r) => n + coinsFor(r), 0)

export type ShopItem = { id: string; kind: 'theme'; name: string; price: number }
export const SHOP: readonly ShopItem[] = [
  { id: 'slate', kind: 'theme', name: 'Slate', price: 150 },
  { id: 'rose', kind: 'theme', name: 'Rose', price: 250 },
  { id: 'royal', kind: 'theme', name: 'Royal', price: 400 },
  { id: 'gold', kind: 'theme', name: 'Gold', price: 600 },
]
export const itemById = (id: string) => SHOP.find((i) => i.id === id)

export const spentOn = (owned: readonly string[]): number => owned.reduce((n, id) => n + (itemById(id)?.price ?? 0), 0)
export const balance = (history: readonly Pick<PlayRecord, 'won' | 'daily'>[], owned: readonly string[]): number => Math.max(0, coinsEarned(history) - spentOn(owned))
export const canBuy = (id: string, coins: number, owned: readonly string[]): boolean => {
  const item = itemById(id)
  return !!item && !owned.includes(id) && coins >= item.price
}

/** Blackjack bankroll carried between sessions. */
export const BANKROLL_START = 1000
export const BANKROLL_MAX = 1_000_000
export const BANKROLL_MIN_TO_PLAY = 100
/** The chips to sit down with: what you left with, or a fresh stake when you are (nearly) broke. */
export const stakeFor = (bankroll: number | undefined): number =>
  bankroll === undefined || !Number.isFinite(bankroll) || bankroll < BANKROLL_MIN_TO_PLAY ? BANKROLL_START : Math.min(BANKROLL_MAX, Math.floor(bankroll))
