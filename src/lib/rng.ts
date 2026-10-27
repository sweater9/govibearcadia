export type Random = () => number

/** FNV-1a string hash → unsigned 32-bit integer. */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** Small, fast, seedable PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): Random {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Deterministic when a seed is given, otherwise `Math.random`. */
export function createRandom(seed?: string): Random {
  return seed === undefined ? Math.random : mulberry32(hashSeed(seed))
}

/** Unbiased Fisher–Yates shuffle. Returns a new array. */
export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** UTC date key such as `2026-10-27`, used to seed daily challenges identically for every player. */
export function dailySeed(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10)
}
