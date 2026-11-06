/**
 * Taiwanese Mahjong tiles and hand shapes. Pure TypeScript: no React, no browser APIs.
 * Tile types: 0-8 Characters, 9-17 Dots, 18-26 Bamboo, 27-30 East South West North, 31-33 Red Green White dragons, 34-41 Flowers.
 */
export const TYPES = 34
export const FLOWER_BASE = 34
export const FLOWERS = 8
export const WIND_BASE = 27
export const DRAGON_BASE = 31

export const isFlower = (t: number) => t >= FLOWER_BASE
export const isHonour = (t: number) => t >= WIND_BASE && t < FLOWER_BASE
export const isWind = (t: number) => t >= WIND_BASE && t < DRAGON_BASE
export const isDragon = (t: number) => t >= DRAGON_BASE && t < FLOWER_BASE
export const isSuited = (t: number) => t < WIND_BASE
export const suitOf = (t: number) => Math.floor(t / 9)
export const rankOf = (t: number) => (t % 9) + 1

const SUITS = ['Characters', 'Dots', 'Bamboo']
const HONOURS = ['East', 'South', 'West', 'North', 'Red Dragon', 'Green Dragon', 'White Dragon']
const FLOWER_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter', 'Plum', 'Orchid', 'Chrysanthemum', 'Bamboo flower']
export function tileName(t: number): string {
  if (isFlower(t)) return FLOWER_NAMES[t - FLOWER_BASE]
  if (isHonour(t)) return HONOURS[t - WIND_BASE]
  return `${rankOf(t)} ${SUITS[suitOf(t)]}`
}
/** A short label for tiles on screen. */
export function tileShort(t: number): string {
  if (isFlower(t)) return FLOWER_NAMES[t - FLOWER_BASE].slice(0, 2)
  if (isHonour(t)) return ['E', 'S', 'W', 'N', 'Rd', 'Gr', 'Wh'][t - WIND_BASE]
  return `${rankOf(t)}${['c', 'd', 'b'][suitOf(t)]}`
}

/** The flower tiles that belong to a seat wind: East has Spring and Plum, South Summer and Orchid, and so on. */
export const seatFlowers = (windIndex: number) => [FLOWER_BASE + windIndex, FLOWER_BASE + 4 + windIndex]

export const counts = (tiles: readonly number[]): number[] => {
  const c = new Array<number>(TYPES).fill(0)
  for (const t of tiles) if (!isFlower(t)) c[t]++
  return c
}

export type SetKind = 'chow' | 'pung'
export type SetOf = { kind: SetKind; tile: number }
export type Split = { pair: number; sets: SetOf[] }

/** Every way to split the concealed tiles into `need` sets and one pair (a chow is named by its lowest tile). */
export function splits(c: readonly number[], need: number): Split[] {
  const out: Split[] = []
  const work = [...c]
  const sets: SetOf[] = []
  const go = (from: number, pair: number) => {
    let i = from
    while (i < TYPES && work[i] === 0) i++
    if (i === TYPES) {
      if (sets.length === need && pair >= 0) out.push({ pair, sets: [...sets] })
      return
    }
    if (sets.length > need) return
    if (pair < 0 && work[i] >= 2) {
      work[i] -= 2
      go(i, i)
      work[i] += 2
    }
    if (work[i] >= 3 && sets.length < need) {
      work[i] -= 3
      sets.push({ kind: 'pung', tile: i })
      go(i, pair)
      sets.pop()
      work[i] += 3
    }
    if (isSuited(i) && rankOf(i) <= 7 && work[i + 1] > 0 && work[i + 2] > 0 && sets.length < need) {
      work[i]--
      work[i + 1]--
      work[i + 2]--
      sets.push({ kind: 'chow', tile: i })
      go(i, pair)
      sets.pop()
      work[i]++
      work[i + 1]++
      work[i + 2]++
    }
  }
  go(0, -1)
  return out
}

/** Can these concealed tiles, with `melds` sets already on the table, make a complete hand? */
export function isComplete(c: readonly number[], melds: number): boolean {
  return splits(c, 5 - melds).length > 0
}

/**
 * Shanten number: how many tile swaps from a complete hand (-1 complete, 0 one tile from winning).
 * Counts melds and partial sets (pairs, runs, gaps) the usual way, with the pair as a bonus.
 */
export function shanten(c: readonly number[], melds: number): number {
  const work = [...c]
  let best = 8
  const need = 5 - melds
  const go = (i: number, sets: number, partials: number, pair: boolean) => {
    while (i < TYPES && work[i] === 0) i++
    if (i === TYPES) {
      const p = Math.min(partials, need - sets)
      best = Math.min(best, 2 * need - 2 * sets - p - (pair ? 1 : 0))
      return
    }
    if (work[i] >= 3) {
      work[i] -= 3
      go(i, sets + 1, partials, pair)
      work[i] += 3
    }
    if (isSuited(i) && rankOf(i) <= 7 && work[i + 1] > 0 && work[i + 2] > 0) {
      work[i]--
      work[i + 1]--
      work[i + 2]--
      go(i, sets + 1, partials, pair)
      work[i]++
      work[i + 1]++
      work[i + 2]++
    }
    if (!pair && work[i] >= 2) {
      work[i] -= 2
      go(i, sets, partials, true)
      work[i] += 2
    }
    if (work[i] >= 2) {
      work[i] -= 2
      go(i, sets, partials + 1, pair)
      work[i] += 2
    }
    if (isSuited(i) && rankOf(i) <= 8 && work[i + 1] > 0) {
      work[i]--
      work[i + 1]--
      go(i, sets, partials + 1, pair)
      work[i]++
      work[i + 1]++
    }
    if (isSuited(i) && rankOf(i) <= 7 && work[i + 2] > 0) {
      work[i]--
      work[i + 2]--
      go(i, sets, partials + 1, pair)
      work[i]++
      work[i + 2]++
    }
    // Leave this tile as a loose one.
    work[i]--
    go(i, sets, partials, pair)
    work[i]++
  }
  go(0, 0, 0, false)
  return best
}
