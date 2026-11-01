import { isNick, nickName, type Nick } from './leaderboard'
import type { Random } from './rng'

/**
 * Friend challenges: a link that deals a friend the very same seeded puzzle and tells them the score to beat.
 * Everything is in the link and checked on arrival; there is no server and no account. A score in a link is
 * self-reported, so this is for friends, not rankings. Pure: no React or browser APIs.
 */

const SEED = /^[A-Za-z0-9_-]{1,40}$/
export const MAX_SCORE = 10_000_000

export type Challenge = {
  seed: string
  /** The score to beat. */
  beat: number
  /** Whether the challenger won their run. */
  won: boolean
  /** The challenger's word-list nickname, or null if they have none. */
  from: string | null
}

/** A fresh puzzle seed, so a run can be sent to a friend afterwards. */
export function randomSeed(random: Random = Math.random): string {
  let out = ''
  for (let i = 0; i < 10; i++) out += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(random() * 36)]
  return out
}

/** The path (and query) of a challenge link. Combine with the site origin to share it. */
export function challengePath(gameId: string, seed: string, result: { score: number; won: boolean }, from: Nick | null): string {
  const q = new URLSearchParams({ seed, beat: String(Math.max(0, Math.min(MAX_SCORE, Math.round(result.score)))), w: result.won ? '1' : '0' })
  if (from) q.set('from', `${from.a}.${from.n}.${from.k}`)
  return `/play/${gameId}?${q.toString()}`
}

/** Reads a challenge out of a page's query string. Anything malformed means "no challenge", never an error. */
export function parseChallenge(params: URLSearchParams): Challenge | null {
  const seed = params.get('seed')
  const beatText = params.get('beat')
  if (!seed || !SEED.test(seed) || beatText === null || !/^\d{1,8}$/.test(beatText)) return null
  const beat = Number(beatText)
  if (beat > MAX_SCORE) return null
  const w = params.get('w')
  if (w !== '0' && w !== '1') return null
  let from: string | null = null
  const raw = params.get('from')
  if (raw !== null) {
    const [a, n, k, ...extra] = raw.split('.').map((x) => (/^\d{1,3}$/.test(x) ? Number(x) : NaN))
    const nick = { a, n, k }
    if (extra.length === 0 && isNick(nick)) from = nickName(nick)
  }
  return { seed, beat, won: w === '1', from }
}

export type Verdict = 'beat' | 'tie' | 'short'

/** Winning beats not winning; otherwise the higher score wins. */
export function verdict(mine: { score: number; won: boolean }, theirs: { score: number; won: boolean }): Verdict {
  if (mine.won !== theirs.won) return mine.won ? 'beat' : 'short'
  return mine.score > theirs.score ? 'beat' : mine.score === theirs.score ? 'tie' : 'short'
}

export function verdictText(v: Verdict, mine: number, challenge: Pick<Challenge, 'beat' | 'from'>): string {
  const who = challenge.from ?? 'your friend'
  if (v === 'beat') return `You beat ${who}: ${mine.toLocaleString()} against ${challenge.beat.toLocaleString()}.`
  if (v === 'tie') return `A tie with ${who} at ${mine.toLocaleString()}.`
  return `Not this time: ${mine.toLocaleString()} against ${who}'s ${challenge.beat.toLocaleString()}. Try again on the same puzzle.`
}

/** The message that gets copied: plain text with the link. */
export function shareChallenge(title: string, result: { score: number; won: boolean }, url: string): string {
  return `I ${result.won ? 'won' : 'played'} ${title} on GoVibeArcadia with ${result.score.toLocaleString()}. Same puzzle, can you beat it? ${url}`
}
