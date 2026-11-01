import type { Random } from './rng'

/**
 * Pure helpers for the leaderboards: word-list nicknames (so there is never any free text to moderate), the week
 * key, and which games are ranked. Shared by the browser and the Worker. No React or browser APIs.
 */

export const ADJECTIVES = [
  'Brave', 'Calm', 'Clever', 'Cosmic', 'Crimson', 'Daring', 'Electric', 'Fuzzy',
  'Gentle', 'Golden', 'Happy', 'Icy', 'Jolly', 'Keen', 'Lucky', 'Mighty',
  'Neon', 'Nimble', 'Odd', 'Plucky', 'Quick', 'Quiet', 'Rapid', 'Sleepy',
  'Sly', 'Snappy', 'Sunny', 'Swift', 'Tiny', 'Vivid', 'Wild', 'Witty',
] as const

export const NOUNS = [
  'Otter', 'Falcon', 'Panda', 'Comet', 'Fox', 'Gecko', 'Heron', 'Ibis',
  'Jaguar', 'Koala', 'Lynx', 'Moth', 'Newt', 'Owl', 'Puffin', 'Quokka',
  'Raven', 'Seal', 'Tiger', 'Urchin', 'Viper', 'Walrus', 'Yak', 'Zebra',
  'Badger', 'Crane', 'Dolphin', 'Eagle', 'Ferret', 'Goose', 'Hare', 'Lemur',
] as const

export type Nick = { a: number; n: number; k: number }

const inRange = (v: unknown, size: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < size

/** True only for three in-range indices, so a client can never smuggle text into a nickname. */
export const isNick = (v: unknown): v is Nick => typeof v === 'object' && v !== null && inRange((v as Nick).a, ADJECTIVES.length) && inRange((v as Nick).n, NOUNS.length) && inRange((v as Nick).k, 100)

export const nickName = (nick: Nick): string => `${ADJECTIVES[nick.a]} ${NOUNS[nick.n]} ${nick.k}`

export const randomNick = (random: Random = Math.random): Nick => ({
  a: Math.floor(random() * ADJECTIVES.length),
  n: Math.floor(random() * NOUNS.length),
  k: Math.floor(random() * 100),
})

/** Games that can be ranked: the ones with online rooms. */
export const RANKED_GAMES = ['connect-four', 'tic-tac-toe', 'checkers', 'battleship'] as const
export const isRankedGame = (v: unknown): v is (typeof RANKED_GAMES)[number] => RANKED_GAMES.includes(v as never)

/** The UTC day, `YYYY-MM-DD`. */
export const dayKey = (now: Date): string => now.toISOString().slice(0, 10)

/** The Monday (UTC) that starts the week containing `now`, `YYYY-MM-DD`. Weeks run Monday to Sunday. */
export function weekKey(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const sinceMonday = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - sinceMonday)
  return dayKey(d)
}

/** At most this many wins a day count for one player against the same opponent. */
export const MAX_WINS_PER_PAIR_PER_DAY = 3
/** Rows a leaderboard returns. */
export const TOP_N = 20

export type BoardRow = { rank: number; name: string; wins: number }
export type Board = { game: string; period: 'week' | 'all'; week: string; rows: BoardRow[] }
