import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { expect, it } from 'vitest'

it('upgrades an existing v1 database to v2 without losing player data', async () => {
  // Simulate a returning player whose browser still holds the original v1 schema.
  const legacy = new Dexie('govibearcadia')
  legacy.version(1).stores({ progress: 'gameId,lastPlayed', favorites: 'gameId,addedAt' })
  await legacy.table('progress').put({ gameId: 'neon-merge', highScore: 2048, plays: 7, lastPlayed: '2026-10-20T10:00:00.000Z' })
  await legacy.table('favorites').put({ gameId: 'pulse-tap', addedAt: '2026-10-21T10:00:00.000Z' })
  legacy.close()

  const { db, recordPlay } = await import('./db')
  expect(await db.progress.get('neon-merge')).toMatchObject({ highScore: 2048, plays: 7 })
  expect(await db.favorites.get('pulse-tap')).toBeDefined()

  await recordPlay('neon-merge', { score: 64 })
  expect(await db.history.count()).toBe(1)
  expect(await db.progress.get('neon-merge')).toMatchObject({ highScore: 2048, plays: 8 })
})

it('v3 adds the wallet: buying spends earned coins and the Blackjack bankroll carries over', async () => {
  const { db, recordPlay, getWallet, buyItem, saveBankroll, blackjackStake } = await import('./db')
  await db.history.clear()
  await db.wallet.clear()
  expect(await buyItem('slate')).toBe(false) // nothing earned yet
  for (let i = 0; i < 8; i++) await recordPlay('neon-merge', { score: 10, won: true }) // 8 x 20 = 160
  expect((await getWallet()).coins).toBe(160)
  expect(await buyItem('slate')).toBe(true)
  expect(await buyItem('slate')).toBe(false) // already owned
  expect(await getWallet()).toMatchObject({ coins: 10, owned: ['slate'] })
  expect(await blackjackStake()).toBe(1000)
  await saveBankroll(2750)
  expect(await blackjackStake()).toBe(2750)
  await saveBankroll(20)
  expect(await blackjackStake()).toBe(1000) // restaked when broke  // Poker keeps its own chips: a buy-in comes off them, a prize goes on, and Blackjack's are untouched.
  const { getPokerChips, payPokerBuyIn, payPokerPrize } = await import('./db')
  expect(await getPokerChips()).toBe(1000)
  await payPokerBuyIn()
  expect(await getPokerChips()).toBe(900)
  await payPokerPrize(300)
  expect(await getPokerChips()).toBe(1200)
  expect(await blackjackStake()).toBe(1000)
})
