import type { Random } from '../../lib/rng'
import { aimDir, angleFor, baseline, COIN_R, kindOfSide, MAX_ANGLE, POCKETS, sideOf, STRIKER_R, strikerAt, strikerBlocked, type Aim, type Coin, type State } from './rules'

export type Level = 'easy' | 'medium' | 'hard'
export const LEVELS: readonly Level[] = ['easy', 'medium', 'hard']
/** Aim error in radians (one standard spread), and how far the power may be off. */
const NOISE: Record<Level, { angle: number; power: number }> = {
  easy: { angle: (7 * Math.PI) / 180, power: 0.25 },
  medium: { angle: (2.5 * Math.PI) / 180, power: 0.12 },
  hard: { angle: (0.7 * Math.PI) / 180, power: 0.05 },
}

const distToSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy
  const k = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2))
  return Math.hypot(px - (ax + k * dx), py - (ay + k * dy))
}

type Candidate = { aim: Aim; score: number }

/** Geometric "ghost ball" planning: no simulation, so it is cheap and the same on every device. */
export function candidates(s: State, seat: number): Candidate[] {
  const side = sideOf(seat)
  const own = kindOfSide(side)
  const live = s.coins.filter((c) => !c.pocketed)
  const wanted: Coin[] = live.filter((c) => c.kind === own || (c.kind === 'queen' && s.queen !== 'covered'))
  const out: Candidate[] = []
  for (let i = -8; i <= 8; i++) {
    const t = i / 8
    if (strikerBlocked(s.coins, seat, t)) continue
    const st = strikerAt(seat, t)
    for (const coin of wanted) {
      for (const [px, py] of POCKETS) {
        const cx = px - coin.x
        const cy = py - coin.y
        const cl = Math.hypot(cx, cy)
        const ux = cx / cl
        const uy = cy / cl
        const gx = coin.x - ux * (COIN_R + STRIKER_R)
        const gy = coin.y - uy * (COIN_R + STRIKER_R)
        const sx = gx - st.x
        const sy = gy - st.y
        const sl = Math.hypot(sx, sy)
        if (sl < 1) continue
        const cut = Math.acos(Math.max(-1, Math.min(1, (sx * ux + sy * uy) / sl)))
        if (cut > (65 * Math.PI) / 180) continue
        const angle = angleFor(seat, sx, sy)
        const b = baseline(seat)
        if ((sx * b.fx + sy * b.fy) / sl < Math.cos(MAX_ANGLE)) continue
        const blocked = live.some(
          (o) =>
            o.id !== coin.id &&
            (distToSegment(o.x, o.y, st.x, st.y, gx, gy) < COIN_R + STRIKER_R - 1 || distToSegment(o.x, o.y, coin.x, coin.y, px, py) < COIN_R * 2 - 1),
        )
        if (blocked) continue
        const power = Math.max(0.3, Math.min(1, (sl + cl) / 1000 + 0.3))
        const queenBias = coin.kind === 'queen' ? (s.queen === 'board' ? -40 : 0) : 0
        out.push({ aim: { t, angle, power }, score: -(sl + cl) * 0.5 - cut * 120 + queenBias })
      }
    }
  }
  return out.sort((a, b) => b.score - a.score)
}

/** The shot the computer plays. Always a legal aim; a plain shot at the middle when nothing can be pocketed. */
export function chooseShot(s: State, seat: number, level: Level, random: Random): Aim {
  const noise = NOISE[level]
  const spread = (n: number) => (random() + random() + random() - 1.5) * (2 / 1.5) * n
  const list = candidates(s, seat)
  let aim: Aim
  if (list.length) {
    const pool = level === 'easy' ? list.slice(0, Math.min(6, list.length)) : level === 'medium' ? list.slice(0, Math.min(2, list.length)) : list.slice(0, 1)
    aim = pool[Math.floor(random() * pool.length)].aim
  } else {
    let t = 0
    for (let i = 0; i <= 8 && strikerBlocked(s.coins, seat, t); i++) t = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.25
    const p = strikerAt(seat, t)
    const d = aimDir(seat, 0)
    void d
    aim = { t, angle: angleFor(seat, 370 - p.x, 370 - p.y), power: 0.5 }
  }
  return {
    t: aim.t,
    angle: Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, aim.angle + spread(noise.angle))),
    power: Math.max(0.15, Math.min(1, aim.power + spread(noise.power))),
  }
}
