/**
 * Quick-match pairing rules (docs/MATCHMAKING.md). Pure: no Worker or browser APIs, so the server and the tests share it.
 * A "player" is the SHA-256 hash of the anonymous token, never the token itself.
 */

/** How long a player may wait before the entry expires. */
export const WAIT_MS = 2 * 60_000
/** How long a made match is remembered, so a player whose connection dropped gets the same room code back. */
export const MATCH_KEEP_MS = 60_000
/** The same two players are not paired again within this time. */
export const REPAIR_MS = 10 * 60_000
/** Most players that may wait for one game at once. */
export const MAX_QUEUE = 200

export type Waiting = { player: string; joinedAt: number }
export type Made = { code: string; at: number }
export type Recent = { pair: string; at: number }
export type MatchState = { waiting: Waiting[]; matched: Record<string, Made>; recent: Recent[] }

export type JoinResult =
  | { kind: 'waiting'; count: number }
  /** `partner` is the player who was already waiting and must be told; `code` is the room both go to. */
  | { kind: 'matched'; code: string; partner: string | null }
  | { kind: 'queue-full' }

/** The two-seat online games that have a quick-match queue (World Trip needs 2 to 6 seats and a Start button, so it is not here). */
export const MATCH_GAMES = ['connect-four', 'tic-tac-toe', 'checkers', 'nine-mens-morris', 'battleship'] as const
export type MatchGame = (typeof MATCH_GAMES)[number]
export const isMatchGame = (value: string): value is MatchGame => (MATCH_GAMES as readonly string[]).includes(value)

export const emptyState = (): MatchState => ({ waiting: [], matched: {}, recent: [] })

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

/** Drops waiting entries, remembered matches and pair records that are past their time. */
export function expire(state: MatchState, now: number, waitMs = WAIT_MS): MatchState {
  return {
    waiting: state.waiting.filter((w) => now - w.joinedAt < waitMs),
    matched: Object.fromEntries(Object.entries(state.matched).filter(([, m]) => now - m.at < MATCH_KEEP_MS)),
    recent: state.recent.filter((r) => now - r.at < REPAIR_MS),
  }
}

/**
 * A player asks for a match. Order of rules:
 * 1. A recent match for this player is returned again (a dropped connection rejoining), with no partner to notify.
 * 2. A player already waiting stays where they are (a second tab replaces the first, and nobody matches themselves).
 * 3. The first waiting player who is not this player and was not paired with them in the last 10 minutes is taken.
 * 4. Otherwise the player waits, unless the queue is full.
 */
export function join(input: MatchState, player: string, now: number, makeCode: () => string, waitMs = WAIT_MS): { state: MatchState; result: JoinResult } {
  const state = expire(input, now, waitMs)

  const again = state.matched[player]
  if (again) return { state, result: { kind: 'matched', code: again.code, partner: null } }

  if (state.waiting.some((w) => w.player === player)) return { state, result: { kind: 'waiting', count: state.waiting.length } }

  const partner = state.waiting.find((w) => w.player !== player && !state.recent.some((r) => r.pair === pairKey(w.player, player)))
  if (partner) {
    const code = makeCode()
    const made = { code, at: now }
    return {
      state: {
        waiting: state.waiting.filter((w) => w.player !== partner.player),
        matched: { ...state.matched, [player]: made, [partner.player]: made },
        recent: [...state.recent, { pair: pairKey(player, partner.player), at: now }],
      },
      result: { kind: 'matched', code, partner: partner.player },
    }
  }

  if (state.waiting.length >= MAX_QUEUE) return { state, result: { kind: 'queue-full' } }
  const waiting = [...state.waiting, { player, joinedAt: now }]
  return { state: { ...state, waiting }, result: { kind: 'waiting', count: waiting.length } }
}

/** A player cancels, or their connection closed while waiting. A made match is left alone. */
export function leave(state: MatchState, player: string): MatchState {
  return { ...state, waiting: state.waiting.filter((w) => w.player !== player) }
}

/** The earliest moment any entry will expire, for scheduling the next alarm; null when there is nothing to expire. */
export function nextExpiry(state: MatchState, waitMs = WAIT_MS): number | null {
  const times = [
    ...state.waiting.map((w) => w.joinedAt + waitMs),
    ...Object.values(state.matched).map((m) => m.at + MATCH_KEEP_MS),
    ...state.recent.map((r) => r.at + REPAIR_MS),
  ]
  return times.length ? Math.min(...times) : null
}
