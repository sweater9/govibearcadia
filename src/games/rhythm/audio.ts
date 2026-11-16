import { isSoundOn } from '../../lib/sound'
import { TRACKS, type Judgement, type TrackId } from './rules'

/**
 * Synthesised backing beat and hit sounds. No audio files, no network. Everything is optional: with sound off (the default) or no
 * AudioContext, these do nothing and the game is played from the visual metronome alone.
 */
let ctx: AudioContext | null = null
function context(): AudioContext | null {
  if (!isSoundOn()) return null
  const Ctor = typeof window === 'undefined' ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
  if (!Ctor) return null
  try {
    ctx ??= new Ctor()
    void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function blip(c: AudioContext, freq: number, ms: number, type: OscillatorType, vol: number, slideTo?: number) {
  const osc = c.createOscillator()
  const gain = c.createGain()
  const t0 = c.currentTime
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + ms / 1000)
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000)
  osc.connect(gain).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + ms / 1000 + 0.02)
}

/** One beat of the backing track: a kick on every beat, a bass note on the first beat of each bar, a hat on the off-beat. */
export function playBeat(trackId: TrackId, beat: number) {
  const c = context()
  if (!c || beat < 0) return
  const t = TRACKS[trackId]
  blip(c, 120, 110, 'sine', 0.18, 45)
  if (beat % 4 === 0) {
    const bar = Math.floor(beat / 4)
    const semis = t.bass[bar % t.bass.length]
    blip(c, t.root * 2 ** (semis / 12), 380, 'triangle', 0.12)
  } else if (beat % 2 === 1) blip(c, 5200, 35, 'square', 0.025)
}

const PITCH: Record<Exclude<Judgement, 'miss'>, number> = { perfect: 880, good: 660 }
export function playJudge(j: Judgement, lane: number) {
  const c = context()
  if (!c) return
  if (j === 'miss') blip(c, 140, 120, 'sawtooth', 0.05, 90)
  else blip(c, PITCH[j] * 2 ** (lane / 12 * 2), 90, 'sine', 0.1)
}
