import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { LEVELS } from './levels'
import { DIFFICULTY, NO_INPUT, enterStage, PH, TILE, cameraX, levelOf, newGame, parseLevel, start, step, VIEW_W, type Input, type PState } from './rules'

const DT = 1 / 120
const rnd = (seed = 'a') => createRandom(seed)
const play = (d: 'easy' | 'normal' | 'hard' = 'normal', seed = 'a') => start(newGame(d, rnd(seed)))

function run(s: PState, input: Input, seconds: number): PState {
  for (let i = 0; i < seconds / DT && s.status === 'playing'; i++) s = step(s, DT, input)
  return s
}

/** Plays by looking ahead: from each state it simulates a few simple plans and takes the first that survives the next second. */
const JUMP_DELAYS = [0, 15, 30, 45, 60]
const PLANS: ((k: number) => Input)[] = [
  () => ({ ...NO_INPUT, right: true }),
  ...JUMP_DELAYS.map((d) => (k: number): Input => ({ ...NO_INPUT, right: true, jump: k >= d && k < d + 80 })),
  ...JUMP_DELAYS.map((d) => (k: number): Input => ({ ...NO_INPUT, right: true, jump: k >= d && k < d + 30 })),
  ...JUMP_DELAYS.flatMap((d) => [75, 85, 100].map((e) => (k: number): Input => ({ ...NO_INPUT, right: true, jump: (k >= d && k < d + 60) || (k >= d + e && k < d + e + 60) }))),
  () => ({ ...NO_INPUT }),
  () => ({ ...NO_INPUT, left: true }),
]
/** Returns how far right the plan gets in a second without dying, or -1 if it dies. */
function reach(s: PState, plan: (k: number) => Input): number {
  const deaths = s.deaths
  const done = s.levelsDone
  for (let k = 0; k < 170; k++) {
    s = step(s, DT, plan(k))
    if (s.levelsDone !== done) return 1e6
    if (s.deaths !== deaths || s.status !== 'playing') return -1
  }
  return s.x
}
function planFor(s: PState): (k: number) => Input {
  let best = PLANS[0]
  let bestX = -2
  for (const p of PLANS) {
    const x = reach(s, p)
    if (x > bestX + 0.5) {
      best = p
      bestX = x
    }
  }
  return best
}

describe('levels', () => {
  it('have one start, one flag and a floor under the start', () => {
    for (const def of LEVELS) {
      const flat = def.rows.join('')
      expect(def.rows.every((r) => r.length === def.rows[0].length)).toBe(true)
      expect([...flat].filter((c) => c === 'P')).toHaveLength(1)
      expect([...flat].filter((c) => c === 'F')).toHaveLength(1)
      const lv = parseLevel(def)
      expect(lv.solid[(lv.start.y + 1) * lv.w + lv.start.x]).toBe(true)
      expect(lv.solid[(lv.flag.y + 1) * lv.w + lv.flag.x]).toBe(true)
    }
  })
  it.each(LEVELS.map((l, i) => [l.name, i] as const))('%s can be finished by a simple bot on every difficulty', (_n, i) => {
    for (const d of ['easy', 'normal', 'hard'] as const) {
      const base = newGame(d, rnd('x'))
      let s = start(enterStage({ ...base, order: [i, (i + 1) % 3, (i + 2) % 3], extra: [[], [], []] }, 0))
      const before = s.levelsDone
      let plan = PLANS[0]
      let k = 0
      for (let n = 0; n < DIFFICULTY[d].time * 120 && s.status === 'playing' && s.levelsDone === before; n++) {
        if (n % 4 === 0) {
          plan = planFor(s)
          k = 0
        }
        s = step(s, DT, plan(k++))
      }
      expect(s.levelsDone, `${LEVELS[i].name} on ${d}: x=${Math.round(s.x)} y=${Math.round(s.y)} lives=${s.lives}`).toBe(before + 1)
    }
  })
})

describe('movement', () => {
  it('stands still on the floor and falls to rest', () => {
    const s = run(play(), NO_INPUT, 0.5)
    expect(s.onGround).toBe(true)
    expect(s.vx).toBe(0)
  })
  it('runs right and left', () => {
    const a = play()
    const r = run(a, { ...NO_INPUT, right: true }, 0.5)
    expect(r.x).toBeGreaterThan(a.x + 20)
    const l = run(r, { ...NO_INPUT, left: true }, 0.5)
    expect(l.x).toBeLessThan(r.x)
  })
  it('jumps higher when the button is held than when it is tapped', () => {
    const peak = (hold: number) => {
      let s = run(play(), NO_INPUT, 0.3)
      const floor = s.y
      let top = floor
      for (let i = 0; i < 120; i++) {
        s = step(s, DT, { ...NO_INPUT, jump: i * DT < hold, jumpPressed: i === 0 })
        top = Math.min(top, s.y)
      }
      return floor - top
    }
    expect(peak(0.6)).toBeGreaterThan(peak(0.05) + 15)
    expect(peak(0.6)).toBeGreaterThan(TILE * 2)
  })
  it('allows a jump just after running off a ledge (coyote time)', () => {
    let s = run(play(), NO_INPUT, 0.3)
    s = { ...s, onGround: false, coyote: 0.05, vy: 0 }
    const j = step(s, DT, { ...NO_INPUT, jump: true, jumpPressed: true })
    expect(j.vy).toBeLessThan(0)
  })
  it('cannot jump in mid-air once coyote time has run out', () => {
    let s = run(play(), NO_INPUT, 0.3)
    s = { ...s, onGround: false, coyote: 0, vy: 50, y: s.y - 40 }
    expect(step(s, DT, { ...NO_INPUT, jump: true, jumpPressed: true }).vy).toBeGreaterThan(0)
  })
  it('stays inside the level walls', () => {
    const s = run(play(), { ...NO_INPUT, left: true }, 3)
    expect(s.x).toBeGreaterThanOrEqual(0)
  })
  it('keeps the camera inside the level', () => {
    const s = play()
    expect(cameraX(s)).toBe(0)
    const far = { ...s, x: levelOf(s).w * TILE - 20 }
    expect(cameraX(far)).toBe(levelOf(s).w * TILE - VIEW_W)
  })
})

describe('hazards and goals', () => {
  it('loses a life and respawns after falling into a pit', () => {
    let s = play('normal')
    s = { ...s, y: levelOf(s).h * TILE + 20, invuln: 0 }
    s = step(s, DT, NO_INPUT)
    expect(s.lives).toBe(DIFFICULTY.normal.lives - 1)
    expect(s.status).toBe('playing')
    expect(s.deaths).toBe(1)
    expect(s.y).toBeLessThan(levelOf(s).h * TILE)
  })
  it('ends the run when the last life is lost', () => {
    let s = play('hard')
    s = { ...s, lives: 1, y: levelOf(s).h * TILE + 20 }
    s = step(s, DT, NO_INPUT)
    expect(s.status).toBe('lost')
    expect(s.lives).toBe(0)
  })
  it('loses a life when the timer runs out', () => {
    let s = play()
    s = { ...s, timeLeft: 0.001 }
    s = step(s, DT, NO_INPUT)
    expect(s.deaths).toBe(1)
    expect(s.timeLeft).toBe(DIFFICULTY.normal.time)
  })
  it('collects a coin once and scores it', () => {
    let s = play()
    const c = s.coins[0]
    s = { ...s, x: c.x * TILE + 3, y: c.y * TILE, vy: 0 }
    s = step(s, DT, NO_INPUT)
    expect(s.coinsGot).toBe(1)
    expect(s.score).toBe(10)
    s = step(s, DT, NO_INPUT)
    expect(s.coinsGot).toBe(1)
  })
  it('hurts on spikes', () => {
    let s = play()
    const lv = levelOf(s)
    const sp = lv.spikes[0]
    s = { ...s, invuln: 0, x: sp.x * TILE + 3, y: sp.y * TILE + 2, vy: 0 }
    s = step(s, DT, NO_INPUT)
    expect(s.deaths).toBe(1)
  })
  it('is safe on spikes for a moment after respawning', () => {
    let s = play()
    const sp = levelOf(s).spikes[0]
    s = { ...s, invuln: 1, x: sp.x * TILE + 3, y: sp.y * TILE + 2, vy: 0 }
    expect(step(s, DT, NO_INPUT).deaths).toBe(0)
  })
  it('stomps a walker from above and gets hurt from the side', () => {
    const base = play()
    const e = base.enemies[0]
    const above = step({ ...base, invuln: 0, x: e.x, y: e.y - PH + 1, vy: 120, onGround: false }, DT, NO_INPUT)
    expect(above.stomps).toBe(1)
    expect(above.enemies[0].alive).toBe(false)
    expect(above.score).toBe(50)
    expect(above.vy).toBeLessThan(0)
    const side = step({ ...base, invuln: 0, x: e.x + 2, y: e.y - 2, vy: 0 }, DT, NO_INPUT)
    expect(side.deaths).toBe(1)
  })
  it('turns walkers around at a ledge or wall', () => {
    let s = { ...play(), invuln: 1e9 }
    const y0 = s.enemies[0].y
    const seen = new Set<number>()
    for (let i = 0; i < 120 * 30; i++) {
      s = step(s, DT, NO_INPUT)
      seen.add(s.enemies[0].dir)
    }
    expect(seen.size).toBe(2)
    expect(s.enemies[0].y).toBe(y0)
    expect(s.enemies[0].x).toBeGreaterThanOrEqual(0)
  })
  it('clears a level at the flag with a time bonus and finally wins', () => {
    let s = play('easy')
    const stages = s.order.length
    for (let i = 0; i < stages; i++) {
      const lv = levelOf(s)
      s = { ...s, x: lv.flag.x * TILE + 3, y: lv.flag.y * TILE, vy: 0, timeLeft: 50.5 }
      s = step(s, DT, NO_INPUT)
    }
    expect(s.status).toBe('won')
    expect(s.levelsDone).toBe(stages)
    expect(s.score).toBeGreaterThanOrEqual(stages * (100 + 100))
  })
})

describe('seeds', () => {
  it('deals the same level order and extra coins for the same seed', () => {
    const a = newGame('normal', rnd('s1'))
    const b = newGame('normal', rnd('s1'))
    expect(a).toEqual(b)
    expect(a.order.slice().sort()).toEqual([0, 1, 2])
  })
  it('varies with the seed', () => {
    const seen = new Set(Array.from({ length: 12 }, (_, i) => JSON.stringify(newGame('normal', rnd(`k${i}`)).extra)))
    expect(seen.size).toBeGreaterThan(1)
  })
  it('puts extra coins on empty tiles standing on ground', () => {
    const s = newGame('easy', rnd('z'))
    s.order.forEach((li, idx) => {
      for (const c of s.extra[idx]) {
        expect(LEVELS[li].rows[c.y][c.x]).toBe('.')
        expect(LEVELS[li].rows[c.y + 1][c.x]).toBe('#')
      }
    })
    expect(s.extra[0]).toHaveLength(DIFFICULTY.easy.extraCoins)
  })
  it('gives harder settings fewer lives and less time', () => {
    expect(DIFFICULTY.hard.lives).toBeLessThan(DIFFICULTY.easy.lives)
    expect(DIFFICULTY.hard.time).toBeLessThan(DIFFICULTY.easy.time)
  })
})
