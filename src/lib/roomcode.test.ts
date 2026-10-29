import { describe, expect, it } from 'vitest'
import { ROOM_ALPHABET, isRoomCode, makeRoomCode, normaliseRoomCode } from './roomcode'

const rand = (bytes: Uint8Array) => crypto.getRandomValues(bytes)

describe('room codes', () => {
  it('have no look-alike characters', () => {
    for (const c of '01OIL') expect(ROOM_ALPHABET).not.toContain(c)
    expect(new Set(ROOM_ALPHABET).size).toBe(ROOM_ALPHABET.length)
  })

  it('are always valid and look random', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 500; i++) {
      const code = makeRoomCode(rand)
      expect(isRoomCode(code)).toBe(true)
      seen.add(code)
    }
    expect(seen.size).toBeGreaterThan(490)
  })

  it('is unbiased: every character is reachable and bytes above the cut-off are skipped', () => {
    // 31 characters: bytes 0..247 are usable (248 = 8 * 31); 248..255 must be skipped.
    const fixed = (bytes: Uint8Array) => bytes.fill(250, 0, 8).fill(0, 8)
    expect(makeRoomCode(fixed)).toBe('AAAAAA')
    const counts = new Map<string, number>()
    for (let i = 0; i < 20000; i++) for (const ch of makeRoomCode(rand)) counts.set(ch, (counts.get(ch) ?? 0) + 1)
    expect(counts.size).toBe(ROOM_ALPHABET.length)
  })

  it('validates strictly', () => {
    for (const bad of ['', 'ABC', 'ABCDEFG', 'abcdef', 'ABCDE0', 'ABCDEI', 'ABCD-F', ' ABCDEF', 123, null, undefined]) expect(isRoomCode(bad)).toBe(false)
    expect(isRoomCode('ABCDEF')).toBe(true)
  })

  it('normalises pasted input', () => {
    expect(normaliseRoomCode(' abc-def ')).toBe('ABCDEF')
    expect(isRoomCode(normaliseRoomCode('k7m 2pq'))).toBe(true)
  })
})
