import type { Seat } from './rules'

/** Playing pieces to choose from, like the tokens in Monopoly. Bold one-colour silhouettes that stay readable at 11px. */
export type Token = { id: string; name: string; /** SVG path data on a 24x24 canvas, filled with the even-odd rule. */ path: string }

export const TOKENS: readonly Token[] = [
  { id: 'crown', name: 'Crown', path: 'M3 18h18v2H3z M3 7l5 5 4-7 4 7 5-5-2 10H5z' },
  { id: 'rocket', name: 'Rocket', path: 'M12 2c3 2 5 6 5 10l-2 3H9l-2-3c0-4 2-8 5-10z M7 14l-3 4 4-1z M17 14l3 4-4-1z M10 17h4l-2 5z M12 7.8a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8z' },
  { id: 'car', name: 'Car', path: 'M2 17v-4l3-1.2L7.3 8h7.4l3.3 3.8 4 1.2v4h-2.8a2.5 2.5 0 0 1-5 0H9.8a2.5 2.5 0 0 1-5 0z M8.6 9.4h2.6v2.4H7z M12.4 9.4h2.1l1.9 2.4h-4z M7.3 15.9a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2z M16.7 15.9a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2z' },
  { id: 'anchor', name: 'Anchor', path: 'M12 2a2.6 2.6 0 1 1 0 5.2A2.6 2.6 0 0 1 12 2z M12 3.6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z M11 7h2v3h4v2h-4v6c3 0 5-2 5-5h2c0 4-3 7-7 7s-7-3-7-7h2c0 3 2 5 5 5v-6H7v-2h4z' },
  { id: 'star', name: 'Star', path: 'M12 2l3 6.5 7 .9-5.2 4.8 1.4 7L12 17.8 5.8 21.2l1.4-7L2 9.4l7-.9z' },
  { id: 'bolt', name: 'Bolt', path: 'M13 2L4 14h6l-1 8 9-12h-6z' },
  { id: 'heart', name: 'Heart', path: 'M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z' },
  { id: 'hat', name: 'Top hat', path: 'M3 17h18v2.5H3z M7 17V4h10v13z M7 11h10v2.5H7z' },
]

export const isToken = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) < TOKENS.length

/**
 * One distinct token per seat. People get their choice (`preferred` for the first person, then the next free tokens in order);
 * computer seats get the rest, spread by `seed` so every game doesn't use the same ones. Pure and deterministic.
 */
export function assignTokens(people: readonly Seat[], preferred: number | null, seed: string): number[] {
  const out: number[] = [-1, -1, -1, -1]
  const used = new Set<number>()
  const take = (want: number) => {
    let t = want
    while (used.has(t)) t = (t + 1) % TOKENS.length
    used.add(t)
    return t
  }
  people.forEach((seat, i) => (out[seat] = take(i === 0 && preferred !== null && isToken(preferred) ? preferred : i)))
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  ;([0, 1, 2, 3] as Seat[]).filter((s) => out[s] === -1).forEach((seat, i) => (out[seat] = take((h + i * 3 + 4) % TOKENS.length)))
  return out
}

/** A saved choice that is not four distinct valid tokens is ignored. */
export const validTokens = (t: unknown): t is number[] => Array.isArray(t) && t.length === 4 && t.every(isToken) && new Set(t).size === 4
