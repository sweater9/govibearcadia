import Dexie, { type EntityTable } from 'dexie'
import type { GameId, GameProgress, GameResult, PlayRecord } from '../types'
import { makeBackup, mergeBackup, type Backup } from './backup'
import { POKER_BUY_IN, balance, canBuy, stakeFor } from './wallet'

type Favorite = { gameId: GameId; addedAt: string }
/** One row, id 'main': bought shop items and the carried-over Blackjack bankroll. Coins earned are derived from history. */
type WalletRow = { id: 'main'; owned: string[]; bankroll?: number; pokerChips?: number }

class ArcadeDB extends Dexie {
  progress!: EntityTable<GameProgress, 'gameId'>
  favorites!: EntityTable<Favorite, 'gameId'>
  history!: EntityTable<PlayRecord, 'id'>
  wallet!: EntityTable<WalletRow, 'id'>

  constructor() {
    super('govibearcadia')
    this.version(1).stores({ progress: 'gameId,lastPlayed', favorites: 'gameId,addedAt' })
    // v2 adds a per-run history log (foundation for stats, XP, streaks and achievements).
    this.version(2).stores({ history: '++id,gameId,playedAt' })
    // v3 adds the wallet (shop purchases and the carried-over Blackjack bankroll).
    this.version(3).stores({ wallet: 'id' })
  }
}

export const db = new ArcadeDB()

/** `daily` is the UTC day key when this run was that day's daily challenge. */
export async function recordPlay(gameId: GameId, result: GameResult, daily?: string): Promise<void> {
  const playedAt = new Date().toISOString()
  await db.transaction('rw', db.progress, db.history, async () => {
    const current = await db.progress.get(gameId)
    await db.progress.put({
      gameId,
      highScore: Math.max(result.score, current?.highScore ?? 0),
      plays: (current?.plays ?? 0) + 1,
      lastPlayed: playedAt,
    })
    await db.history.add({
      gameId,
      score: result.score,
      durationMs: result.durationMs,
      won: result.won,
      playedAt,
      ...(daily ? { daily } : {}),
    })
  })
  changed()
}

export async function toggleFavorite(gameId: GameId): Promise<void> {
  const found = await db.favorites.get(gameId)
  if (found) await db.favorites.delete(gameId)
  else await db.favorites.put({ gameId, addedAt: new Date().toISOString() })
}

/** Everything stored on this device, ready to be written to a backup file. */
export async function exportAll(): Promise<Backup> {
  const [progress, favorites, history, wallet] = await Promise.all([db.progress.toArray(), db.favorites.toArray(), db.history.toArray(), walletOf()])
  return makeBackup({ progress, favorites, history, wallet: { owned: wallet.owned, ...(wallet.bankroll !== undefined ? { bankroll: wallet.bankroll } : {}), ...(wallet.pokerChips !== undefined ? { pokerChips: wallet.pokerChips } : {}) } })
}

/** Merges a validated backup into the database in one transaction. Returns how many new runs were added. */
export async function importBackup(backup: Backup): Promise<number> {
  const added = await db.transaction('rw', db.progress, db.favorites, db.history, db.wallet, async () => {
    const [progress, favorites, history, w] = await Promise.all([db.progress.toArray(), db.favorites.toArray(), db.history.toArray(), walletOf()])
    const merged = mergeBackup({ progress, favorites, history, wallet: { owned: w.owned, bankroll: w.bankroll, pokerChips: w.pokerChips } }, backup)
    await db.wallet.put({ id: 'main', owned: merged.wallet.owned, ...(merged.wallet.bankroll !== undefined ? { bankroll: merged.wallet.bankroll } : {}), ...(merged.wallet.pokerChips !== undefined ? { pokerChips: merged.wallet.pokerChips } : {}) })
    await db.progress.bulkPut(merged.progress)
    await db.favorites.bulkPut(merged.favorites)
    await db.history.bulkAdd(merged.newHistory)
    return merged.newHistory.length
  })
  changed()
  return added
}

const walletOf = async (): Promise<WalletRow> => (await db.wallet.get('main')) ?? { id: 'main', owned: [] }
const changed = () => { try { dispatchEvent(new Event('govibearcadia:wallet')) } catch { /* no window */ } }

export async function getWallet(): Promise<{ coins: number; owned: string[]; bankroll: number | undefined }> {
  const [w, history] = await Promise.all([walletOf(), db.history.toArray()])
  return { coins: balance(history, w.owned), owned: w.owned, bankroll: w.bankroll }
}

/** Buys a shop item if it is affordable and not already owned. Returns whether it was bought. */
export async function buyItem(id: string): Promise<boolean> {
  const ok = await db.transaction('rw', db.wallet, db.history, async () => {
    const w = await walletOf()
    if (!canBuy(id, balance(await db.history.toArray(), w.owned), w.owned)) return false
    await db.wallet.put({ ...w, owned: [...w.owned, id] })
    return true
  })
  if (ok) changed()
  return ok
}

/** The chips to start a Blackjack session with, from the saved bankroll. */
export async function blackjackStake(): Promise<number> {
  return stakeFor((await walletOf()).bankroll)
}
export async function saveBankroll(chips: number): Promise<void> {
  await db.transaction('rw', db.wallet, async () => db.wallet.put({ ...(await walletOf()), bankroll: Math.max(0, Math.floor(chips)) }))
}

/** Your Poker chips (restaked when you cannot cover a buy-in). */
export async function getPokerChips(): Promise<number> {
  return stakeFor((await walletOf()).pokerChips)
}
/** Pays the tournament buy-in out of your Poker chips. */
export async function payPokerBuyIn(buyIn: number = POKER_BUY_IN): Promise<void> {
  await db.transaction('rw', db.wallet, async () => {
    const w = await walletOf()
    await db.wallet.put({ ...w, pokerChips: stakeFor(w.pokerChips) - buyIn })
  })
}
/** Adds a tournament prize to your Poker chips. */
export async function payPokerPrize(amount: number): Promise<void> {
  await db.transaction('rw', db.wallet, async () => {
    const w = await walletOf()
    await db.wallet.put({ ...w, pokerChips: Math.min(1_000_000, stakeFor(w.pokerChips) + Math.max(0, Math.floor(amount))) })
  })
}
