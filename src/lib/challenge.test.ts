import { describe, expect, it } from 'vitest'
import { createRandom } from './rng'
import { challengePath, parseChallenge, randomSeed, shareChallenge, verdict, verdictText } from './challenge'

const parse = (path: string) => parseChallenge(new URL(path, 'https://x.test').searchParams)

describe('challenge links', () => {
  it('round-trips the seed, score, outcome and nickname', () => {
    const path = challengePath('carve', 'abc123', { score: 740, won: true }, { a: 0, n: 1, k: 42 })
    expect(path.startsWith('/play/carve?')).toBe(true)
    expect(parse(path)).toEqual({ seed: 'abc123', beat: 740, won: true, from: 'Brave Falcon 42' })
  })
  it('works without a nickname, and a loss is remembered as one', () => {
    expect(parse(challengePath('twofold', 'seed_1', { score: 0, won: false }, null))).toEqual({ seed: 'seed_1', beat: 0, won: false, from: null })
  })
  it('clamps and rounds the score it writes', () => {
    expect(parse(challengePath('carve', 's', { score: 12.6, won: true }, null))?.beat).toBe(13)
    expect(parse(challengePath('carve', 's', { score: -5, won: true }, null))?.beat).toBe(0)
    expect(parse(challengePath('carve', 's', { score: 1e12, won: true }, null))?.beat).toBe(10_000_000)
  })
  it('treats anything malformed as no challenge', () => {
    for (const bad of ['?seed=abc', '?beat=5&w=1', '?seed=a&beat=-1&w=1', '?seed=a&beat=1.5&w=1', '?seed=a&beat=99999999&w=1', '?seed=a&beat=5', '?seed=a&beat=5&w=2', '?seed=has space&beat=5&w=1', `?seed=${'x'.repeat(41)}&beat=5&w=1`, '?seed=<script>&beat=5&w=1']) {
      expect(parse(`/play/carve${bad}`), bad).toBeNull()
    }
  })
  it('ignores a bad nickname instead of showing it', () => {
    for (const from of ['Brave Otter', '99.0.0', '0.0.100', '0.0', '0.0.0.0', '<b>.1.2', '-1.0.0']) {
      expect(parse(`/play/carve?seed=a&beat=5&w=1&from=${encodeURIComponent(from)}`)?.from, from).toBeNull()
    }
  })
  it('random seeds are valid, and the same stream gives the same seed', () => {
    const s = randomSeed(createRandom('x'))
    expect(s).toMatch(/^[a-z0-9]{10}$/)
    expect(randomSeed(createRandom('x'))).toBe(s)
    expect(parse(challengePath('carve', s, { score: 1, won: true }, null))?.seed).toBe(s)
  })
})

describe('who wins', () => {
  it('a win beats a non-win whatever the scores; otherwise the higher score wins', () => {
    expect(verdict({ score: 10, won: true }, { score: 900, won: false })).toBe('beat')
    expect(verdict({ score: 900, won: false }, { score: 10, won: true })).toBe('short')
    expect(verdict({ score: 800, won: true }, { score: 700, won: true })).toBe('beat')
    expect(verdict({ score: 700, won: true }, { score: 700, won: true })).toBe('tie')
    expect(verdict({ score: 600, won: true }, { score: 700, won: true })).toBe('short')
  })
  it('says it in words', () => {
    expect(verdictText('beat', 820, { beat: 740, from: 'Brave Otter 42' })).toBe('You beat Brave Otter 42: 820 against 740.')
    expect(verdictText('tie', 740, { beat: 740, from: null })).toBe('A tie with your friend at 740.')
    expect(verdictText('short', 700, { beat: 740, from: null })).toContain('Not this time')
  })
  it('the shared message carries the link', () => {
    expect(shareChallenge('Carve', { score: 1200, won: true }, 'https://x.test/play/carve?seed=a')).toBe('I won Carve on GoVibeArcadia with 1,200. Same puzzle, can you beat it? https://x.test/play/carve?seed=a')
  })
})
