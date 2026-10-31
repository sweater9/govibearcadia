/**
 * A small sliding-window counter. Pure (the caller supplies the clock) so it is easy to test.
 * `hit(key, now)` returns true when the action is allowed and false once the key has used up its quota.
 */
export function createLimiter(max: number, windowMs: number, maxKeys = 5000) {
  const seen = new Map<string, number[]>()
  return {
    hit(key: string, now: number): boolean {
      const recent = (seen.get(key) ?? []).filter((t) => now - t < windowMs)
      if (recent.length >= max) {
        seen.set(key, recent)
        return false
      }
      recent.push(now)
      seen.delete(key) // re-insert so the oldest keys are the first to go
      seen.set(key, recent)
      if (seen.size > maxKeys) seen.delete(seen.keys().next().value as string)
      return true
    },
  }
}
