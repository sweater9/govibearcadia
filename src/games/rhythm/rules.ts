import { createRandom } from '../../lib/rng'

/**
 * Pure rules for Rhythm Master: four lanes of falling notes, hit each as it crosses the line. Charts are generated
 * from a seed (so the same seed is the same chart), and judging is a pure function of note time and hit time.
 * No React, no audio, no clocks: the component feeds in times in milliseconds.
 */
export const LANES = 4
/** Hit windows, in milliseconds either side of the note. */
export const PERFECT_MS = 45
export const GOOD_MS = 110

export type Level = 'easy' | 'normal' | 'hard'
export const LEVELS: Record<Level, { label: string; /** How long a note takes to fall to the line. */ fallMs: number; /** Chance a step carries a note. */ density: number; /** Chance of a second note at the same moment. */ chord: number }> = {
  easy: { label: 'Easy', fallMs: 1900, density: 0.42, chord: 0 },
  normal: { label: 'Normal', fallMs: 1500, density: 0.62, chord: 0.04 },
  hard: { label: 'Hard', fallMs: 1150, density: 0.82, chord: 0.12 },
}

export type TrackId = 'drift' | 'pulse' | 'overdrive'
export type Track = { id: TrackId; name: string; bpm: number; bars: number; /** Semitone offsets for the backing bass line, one per bar. */ bass: number[]; /** Root note, Hz. */ root: number }
export const TRACKS: Record<TrackId, Track> = {
  drift: { id: 'drift', name: 'Neon Drift', bpm: 100, bars: 16, bass: [0, 0, 5, 3], root: 110 },
  pulse: { id: 'pulse', name: 'Pulse Runner', bpm: 120, bars: 20, bass: [0, 7, 3, 5], root: 98 },
  overdrive: { id: 'overdrive', name: 'Overdrive', bpm: 140, bars: 24, bass: [0, 3, 7, 10], root: 87.3 },
}
export const TRACK_IDS = Object.keys(TRACKS) as TrackId[]
export const beatMs = (t: Track) => 60000 / t.bpm
/** Length of the music, from the first beat to the end of the last bar. */
export const trackMs = (t: Track) => t.bars * 4 * beatMs(t)
/** Lead-in before the music's first bar: four beats, so notes stay on the beat grid. */
export const leadInMs = (t: Track) => 4 * beatMs(t)

export type Judgement = 'perfect' | 'good' | 'miss'
export type Note = { t: number; lane: number; result: Judgement | null }

/** Chart notes for a track: on the eighth-note grid, denser as the song goes on, never the same lane three times running. */
export function makeChart(trackId: TrackId, level: Level, seed: string): Note[] {
  const track = TRACKS[trackId]
  const rnd = createRandom(`${seed}:${trackId}:${level}`)
  const { density, chord } = LEVELS[level]
  const step = beatMs(track) / 2
  const steps = track.bars * 8
  const notes: Note[] = []
  let prev = -1
  let prev2 = -1
  // The first bar is quiet, the last bar rests, so the song breathes at both ends.
  for (let i = 8; i < steps - 4; i++) {
    const onBeat = i % 2 === 0
    const ramp = 0.75 + 0.5 * (i / steps)
    const chance = Math.min(0.95, density * ramp * (onBeat ? 1.15 : 0.8))
    if (rnd() >= chance) continue
    let lane = Math.floor(rnd() * LANES)
    if (lane === prev && lane === prev2) lane = (lane + 1 + Math.floor(rnd() * (LANES - 1))) % LANES
    const t = leadInMs(track) + i * step
    notes.push({ t, lane, result: null })
    if (rnd() < chord) {
      const second = (lane + 1 + Math.floor(rnd() * (LANES - 1))) % LANES
      notes.push({ t, lane: second, result: null })
    }
    prev2 = prev
    prev = lane
  }
  return notes.sort((a, b) => a.t - b.t || a.lane - b.lane)
}

/** Judges one hit: how far off the note's time the press was. Early and late are treated alike. */
export function judge(noteT: number, hitT: number): Judgement | null {
  const off = Math.abs(hitT - noteT)
  if (off <= PERFECT_MS) return 'perfect'
  if (off <= GOOD_MS) return 'good'
  return null
}

export type RState = {
  trackId: TrackId
  level: Level
  notes: Note[]
  status: 'ready' | 'playing' | 'over'
  /** Song time in milliseconds, advanced by the component. */
  now: number
  score: number
  combo: number
  maxCombo: number
  perfect: number
  good: number
  miss: number
  /** The last judgement and when, for the on-screen flash. */
  last: { judgement: Judgement; lane: number; at: number } | null
}

export function newGame(trackId: TrackId = 'drift', level: Level = 'normal', seed = 'rhythm'): RState {
  return { trackId, level, notes: makeChart(trackId, level, seed), status: 'ready', now: 0, score: 0, combo: 0, maxCombo: 0, perfect: 0, good: 0, miss: 0, last: null }
}

export const start = (s: RState): RState => (s.status === 'ready' ? { ...s, status: 'playing' } : s)

/** Score multiplier from the combo: x1, then one more per ten in a row, up to x4. */
export const multiplier = (combo: number) => Math.min(4, 1 + Math.floor(combo / 10))
export const POINTS: Record<Exclude<Judgement, 'miss'>, number> = { perfect: 300, good: 100 }

function resolve(s: RState, i: number, j: Judgement, lane: number): RState {
  const notes = s.notes.slice()
  notes[i] = { ...notes[i], result: j }
  if (j === 'miss') return { ...s, notes, combo: 0, miss: s.miss + 1, last: { judgement: j, lane, at: s.now } }
  const combo = s.combo + 1
  return {
    ...s, notes, combo, maxCombo: Math.max(s.maxCombo, combo),
    score: s.score + POINTS[j] * multiplier(s.combo),
    perfect: s.perfect + (j === 'perfect' ? 1 : 0), good: s.good + (j === 'good' ? 1 : 0),
    last: { judgement: j, lane, at: s.now },
  }
}

/** A press in `lane` at song time `hitT`. Presses with no note in reach are ignored (no penalty for a stray tap). */
export function hit(s: RState, lane: number, hitT: number): RState {
  if (s.status !== 'playing' || !Number.isInteger(lane) || lane < 0 || lane >= LANES) return s
  let best = -1
  let bestOff = Infinity
  for (let i = 0; i < s.notes.length; i++) {
    const n = s.notes[i]
    if (n.t - hitT > GOOD_MS) break
    if (n.lane !== lane || n.result !== null) continue
    const off = Math.abs(hitT - n.t)
    if (off <= GOOD_MS && off < bestOff) {
      best = i
      bestOff = off
    }
  }
  if (best < 0) return s
  return resolve(s, best, judge(s.notes[best].t, hitT)!, lane)
}

/** Moves song time to `now`: notes that passed the good window unhit are misses, and the song ends after the last note. */
export function advance(s: RState, now: number): RState {
  if (s.status !== 'playing' || now <= s.now) return s
  let next: RState = { ...s, now }
  for (let i = 0; i < next.notes.length; i++) {
    const n = next.notes[i]
    if (n.t + GOOD_MS >= now) break
    if (n.result === null) next = resolve(next, i, 'miss', n.lane)
  }
  const last = next.notes[next.notes.length - 1]
  if (!last || now > last.t + GOOD_MS + 600) return { ...next, status: 'over' }
  return next
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D'
/** Accuracy from 0 to 1: perfects count in full, goods at 60 per cent. */
export function accuracy(s: RState): number {
  const total = s.notes.length
  return total ? (s.perfect + 0.6 * s.good) / total : 0
}
export function grade(s: RState): Grade {
  const a = accuracy(s)
  return a >= 0.95 ? 'S' : a >= 0.9 ? 'A' : a >= 0.8 ? 'B' : a >= 0.7 ? 'C' : 'D'
}
export const GRADE_RANK: Record<Grade, number> = { S: 4, A: 3, B: 2, C: 1, D: 0 }
export const isWin = (s: RState) => grade(s) !== 'D'

/** The lowest y of a note, as a fraction of the lane (0 at the top, 1 at the hit line), for drawing. */
export const fallFraction = (noteT: number, now: number, fallMs: number) => 1 - (noteT - now) / fallMs
