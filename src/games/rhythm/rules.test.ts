import { describe, expect, it } from 'vitest'
import { GOOD_MS, LANES, LEVELS, PERFECT_MS, TRACKS, TRACK_IDS, accuracy, advance, fallFraction, grade, hit, isWin, judge, makeChart, multiplier, newGame, start, trackMs, leadInMs, type Level, type RState } from './rules'

const playing = (o: Partial<RState> = {}): RState => ({ ...start(newGame('drift', 'normal', 't')), ...o })
const withNotes = (notes: [number, number][], o: Partial<RState> = {}): RState => ({ ...playing(), notes: notes.map(([t, lane]) => ({ t, lane, result: null })), ...o })

describe('judge', () => {
  it('is perfect inside the tight window, good inside the wide one, otherwise nothing, early or late', () => {
    expect(judge(1000, 1000)).toBe('perfect')
    expect(judge(1000, 1000 + PERFECT_MS)).toBe('perfect')
    expect(judge(1000, 1000 - PERFECT_MS)).toBe('perfect')
    expect(judge(1000, 1000 + PERFECT_MS + 1)).toBe('good')
    expect(judge(1000, 1000 - GOOD_MS)).toBe('good')
    expect(judge(1000, 1000 + GOOD_MS + 1)).toBeNull()
    expect(judge(1000, 400)).toBeNull()
  })
})

describe('charts', () => {
  it('are deterministic for a seed and differ between seeds, tracks and levels', () => {
    const a = makeChart('pulse', 'normal', 's1')
    expect(makeChart('pulse', 'normal', 's1')).toEqual(a)
    expect(makeChart('pulse', 'normal', 's2')).not.toEqual(a)
    expect(makeChart('drift', 'normal', 's1')).not.toEqual(a)
    expect(makeChart('pulse', 'hard', 's1')).not.toEqual(a)
  })
  it('stay inside the song, on valid lanes, in time order, and get denser with level', () => {
    for (const id of TRACK_IDS) {
      const counts = (['easy', 'normal', 'hard'] as Level[]).map((l) => {
        const c = makeChart(id, l, 'x')
        expect(c.length).toBeGreaterThan(20)
        for (const n of c) {
          expect(n.lane).toBeGreaterThanOrEqual(0)
          expect(n.lane).toBeLessThan(LANES)
          expect(n.t).toBeGreaterThanOrEqual(leadInMs(TRACKS[id]))
          expect(n.t).toBeLessThanOrEqual(leadInMs(TRACKS[id]) + trackMs(TRACKS[id]))
        }
        expect(c.map((n) => n.t)).toEqual([...c.map((n) => n.t)].sort((x, y) => x - y))
        return c.length
      })
      expect(counts[0]).toBeLessThan(counts[1])
      expect(counts[1]).toBeLessThan(counts[2])
    }
  })
  it('never put two notes in one lane at the same moment, and there are three tracks and three levels', () => {
    const c = makeChart('overdrive', 'hard', 'dup')
    const seen = new Set(c.map((n) => `${n.t}:${n.lane}`))
    expect(seen.size).toBe(c.length)
    expect(TRACK_IDS).toHaveLength(3)
    expect(Object.keys(LEVELS)).toHaveLength(3)
  })
})

describe('hitting', () => {
  it('scores a perfect and a good, builds combo, and marks the note', () => {
    let s = withNotes([[3000, 0], [3500, 1]])
    s = hit(s, 0, 3010)
    expect(s.perfect).toBe(1)
    expect(s.score).toBe(300)
    expect(s.combo).toBe(1)
    s = hit(s, 1, 3500 + 90)
    expect(s.good).toBe(1)
    expect(s.score).toBe(400)
    expect(s.notes.every((n) => n.result)).toBe(true)
  })
  it('ignores presses in the wrong lane, too early, twice, or before the game starts', () => {
    const s = withNotes([[3000, 0]])
    expect(hit(s, 1, 3000)).toBe(s)
    expect(hit(s, 0, 3000 - GOOD_MS - 1)).toBe(s)
    const once = hit(s, 0, 3000)
    expect(hit(once, 0, 3000)).toBe(once)
    expect(hit(newGame(), 0, 2400)).toEqual(newGame())
    expect(hit(s, 7, 3000)).toBe(s)
    expect(hit(s, -1, 3000)).toBe(s)
    expect(hit(s, 0.5, 3000)).toBe(s)
  })
  it('a stray press does not break the combo', () => {
    let s = withNotes([[3000, 0], [6000, 1]])
    s = hit(s, 0, 3000)
    s = hit(s, 2, 4000)
    expect(s.combo).toBe(1)
    expect(s.miss).toBe(0)
  })
  it('takes the closest of two notes in the same lane', () => {
    let s = withNotes([[3000, 0], [3100, 0]])
    s = hit(s, 0, 3090)
    expect(s.notes[1].result).toBe('perfect')
    expect(s.notes[0].result).toBeNull()
  })
  it('the multiplier grows every ten and stops at four', () => {
    expect([0, 9, 10, 19, 20, 30, 99].map(multiplier)).toEqual([1, 1, 2, 2, 3, 4, 4])
    const notes: [number, number][] = Array.from({ length: 12 }, (_, i) => [3000 + i * 200, 0])
    let s = withNotes(notes)
    for (const [t] of notes) s = hit(s, 0, t)
    // ten at x1 (3000), then two at x2 (600 each).
    expect(s.score).toBe(10 * 300 + 2 * 300 * 2)
    expect(s.maxCombo).toBe(12)
  })
})

describe('advancing', () => {
  it('turns a note nobody hit into a miss once it is past the window, and resets the combo', () => {
    let s = withNotes([[3000, 0], [4000, 1]])
    s = hit(s, 0, 3000)
    s = advance(s, 3000 + GOOD_MS)
    expect(s.miss).toBe(0)
    s = advance(s, 4000 + GOOD_MS + 1)
    expect(s.miss).toBe(1)
    expect(s.combo).toBe(0)
    expect(s.maxCombo).toBe(1)
  })
  it('ends the song a little after the last note, and never runs time backwards', () => {
    let s = withNotes([[3000, 0]])
    s = advance(s, 3000 + GOOD_MS + 200)
    expect(s.status).toBe('playing')
    expect(advance(s, 100)).toBe(s)
    s = advance(s, 3000 + GOOD_MS + 700)
    expect(s.status).toBe('over')
    expect(advance(s, 99999)).toBe(s)
  })
  it('a whole song of perfect hits scores S, a whole song of nothing scores D', () => {
    let s = playing()
    for (const n of s.notes) s = hit(advance(s, n.t), n.lane, n.t)
    s = advance(s, s.notes[s.notes.length - 1].t + 2000)
    expect(s.status).toBe('over')
    expect(s.miss).toBe(0)
    expect(grade(s)).toBe('S')
    expect(isWin(s)).toBe(true)
    let idle = playing()
    idle = advance(idle, idle.notes[idle.notes.length - 1].t + 2000)
    expect(idle.miss).toBe(idle.notes.length)
    expect(grade(idle)).toBe('D')
    expect(isWin(idle)).toBe(false)
    expect(accuracy(idle)).toBe(0)
  })
})

describe('grades and drawing', () => {
  it('grades by accuracy bands', () => {
    const mk = (perfect: number, good: number, total: number) => ({ ...playing(), perfect, good, notes: Array.from({ length: total }, () => ({ t: 0, lane: 0, result: null })) }) as RState
    expect([mk(100, 0, 100), mk(92, 0, 100), mk(82, 0, 100), mk(72, 0, 100), mk(50, 0, 100)].map(grade)).toEqual(['S', 'A', 'B', 'C', 'D'])
    expect(grade(mk(0, 100, 100))).toBe('D')
  })
  it('a note is at the top when it first appears and on the line at its time', () => {
    expect(fallFraction(5000, 5000 - 1500, 1500)).toBeCloseTo(0)
    expect(fallFraction(5000, 5000, 1500)).toBeCloseTo(1)
    expect(fallFraction(5000, 5000 - 750, 1500)).toBeCloseTo(0.5)
  })
})
