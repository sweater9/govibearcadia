/**
 * Named computer opponents for quick match. When nobody else is waiting, a player is offered one of these after
 * the wait. They are always shown with the "(computer)" tag, play the game's normal single-player page, and never
 * count towards the online leaderboard.
 */
export const COMPUTER_PLAYERS = ['Ada', 'Zara', 'Mei', 'Sophia', 'Ananya'] as const
export type ComputerPlayer = (typeof COMPUTER_PLAYERS)[number]

/** The computer joins this long after the offer appears (the offer itself appears at OFFER_AFTER_MS). */
export const COMPUTER_GRACE_MS = 3_000

/** How strong each computer plays, 0 (gentlest) to 4 (hardest). Each game maps this to its own setting. */
export const STRENGTH: Record<ComputerPlayer, 0 | 1 | 2 | 3 | 4> = { Ada: 0, Mei: 1, Zara: 2, Sophia: 3, Ananya: 4 }

/** Picks the entry for this computer's strength; without a named computer the game keeps its own default. */
export function byStrength<T>(computer: string | null | undefined, table: readonly [T, T, T, T, T], fallback: T): T {
  const name = parseComputer(computer ?? null)
  return name ? table[STRENGTH[name]] : fallback
}

export const computerLabel = (name: string): string => `${name} (computer)`

/** Accepts only a known name, so a crafted `?vs=` link cannot put arbitrary text on the page. */
export function parseComputer(value: string | null): ComputerPlayer | null {
  return COMPUTER_PLAYERS.find((n) => n === value) ?? null
}

/** Picks one at random; pass a deterministic `random` in tests. */
export function pickComputer(random: () => number = Math.random): ComputerPlayer {
  return COMPUTER_PLAYERS[Math.min(COMPUTER_PLAYERS.length - 1, Math.floor(random() * COMPUTER_PLAYERS.length))]
}
