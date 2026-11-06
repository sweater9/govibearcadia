import type { Random } from '../../lib/rng'
import { roundWindOf, kongChoices, selfDrawScore, windOf, type Action, type Decision, type State } from './rules'
import { WIND_BASE, counts, isDragon, isHonour, isSuited, rankOf, shanten, suitOf } from './tiles'

export type Level = 'easy' | 'medium' | 'hard'
export const LEVELS: readonly Level[] = ['easy', 'medium', 'hard']

/** How well a tile fits the rest of the hand: neighbours and copies make it worth keeping. Lower means safer to throw. */
function keepValue(c: readonly number[], t: number): number {
  let v = c[t] >= 2 ? 3 * (c[t] - 1) : 0
  if (isSuited(t)) {
    for (const d of [-2, -1, 1, 2]) {
      const u = t + d
      if (u >= 0 && u < 27 && suitOf(u) === suitOf(t) && c[u] > 0) v += Math.abs(d) === 1 ? 2 : 1
    }
    const r = rankOf(t)
    if (r === 1 || r === 9) v -= 0.5
  } else if (c[t] === 1) v -= 1
  return v
}

/** The discard that leaves the hand closest to winning; ties go to the tile that fits least. */
export function chooseDiscard(s: State, seat: number, level: Level, random: Random): number {
  const p = s.seats[seat]
  const tiles = [...new Set(p.hand)]
  const c = counts(p.hand)
  if (level === 'easy' && random() < 0.35) return tiles[Math.floor(random() * tiles.length)]
  let best = tiles[0]
  let bestScore = -Infinity
  for (const t of tiles) {
    c[t]--
    const sh = shanten(c, p.melds.length)
    let score = -sh * 100 - keepValue(c, t) * 0
    if (level !== 'easy') {
      // Prefer a hand with more tiles that would improve it.
      let improving = 0
      for (let u = 0; u < 34; u++) {
        if (c[u] >= 4) continue
        c[u]++
        if (shanten(c, p.melds.length) < sh) improving += 4 - c[u] + 1
        c[u]--
      }
      score += improving * (level === 'hard' ? 1 : 0.4)
    }
    c[t]++
    score -= keepValue(c, t) * 2
    // Throwing a tile others have thrown already is a little safer (hard only).
    if (level === 'hard') for (const o of s.seats) if (o.discards.includes(t)) score += 0.8
    if (score > bestScore) {
      bestScore = score
      best = t
    }
  }
  return best
}

export function chooseTurnAction(s: State, seat: number, level: Level, random: Random): Action {
  if (selfDrawScore(s, seat)) return { type: 'tsumo' }
  if (level !== 'easy') {
    const k = kongChoices(s, seat)
    if (k.concealed.length) return { type: 'concealed-kong', tile: k.concealed[0] }
    if (k.added.length) return { type: 'added-kong', tile: k.added[0] }
  }
  return { type: 'discard', tile: chooseDiscard(s, seat, level, random) }
}

const valuablePung = (s: State, seat: number, t: number) => isDragon(t) || t === WIND_BASE + windOf(s, seat) || t === WIND_BASE + roundWindOf(s)

/** Win whenever possible; otherwise claim only what moves the hand forward. */
export function chooseClaim(s: State, seat: number, level: Level, random: Random): Decision {
  const o = s.options[seat]
  const last = s.last
  if (!o || !last) return { type: 'pass' }
  if (o.win) return { type: 'win' }
  const p = s.seats[seat]
  const c = counts(p.hand)
  const before = shanten(c, p.melds.length)
  const t = last.tile
  if (level === 'easy') return o.pung && isHonour(t) && random() < 0.5 && valuablePung(s, seat, t) ? { type: 'pung' } : { type: 'pass' }
  if (o.kong && (valuablePung(s, seat, t) || before <= 1)) return { type: 'kong' }
  const trial = (remove: number[]) => {
    const x = [...c]
    for (const r of remove) x[r]--
    return shanten(x, p.melds.length + 1)
  }
  if (o.pung) {
    const after = trial([t, t])
    if (after < before || (after === before && valuablePung(s, seat, t))) return { type: 'pung' }
  }
  if (o.chows.length) {
    let bestLow = -1
    let bestAfter = before
    for (const low of o.chows) {
      const after = trial([low, low + 1, low + 2].filter((x) => x !== t))
      if (after < bestAfter) {
        bestAfter = after
        bestLow = low
      }
    }
    if (bestLow >= 0 && (level === 'hard' ? true : random() < 0.8)) return { type: 'chow', low: bestLow }
  }
  return { type: 'pass' }
}
