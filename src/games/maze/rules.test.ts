import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { CAMPAIGN_LEVELS, DIFFICULTIES, campaignConfig, campaignLevel, endlessLevel, introduces, startLevel } from './levels'
import { DIRS, DIR_LIST, distances, generate, isSolvable, move, newState, openNeighbours, parMs, route, score, stars, tick, trapActive, type Config, type Dir, type Level, type MState } from './rules'

const BASE: Config = { w: 9, h: 9, braid: 0, coins: 0, traps: 0, togglingTraps: false, doors: 0, enemies: 0, enemyMs: 600, powers: 0, timed: 0, fog: 0 }
const idx = (l: Level, p: { x: number; y: number }) => p.y * l.w + p.x
const dirBetween = (l: Level, a: number, b: number): Dir => DIR_LIST.find((d) => a % l.w + DIRS[d].dx === b % l.w && Math.floor(a / l.w) + DIRS[d].dy === Math.floor(b / l.w)) as Dir

/** Plays a route with move(), returning the final state. */
function walk(s: MState, cells: number[]): MState {
  let cur = s
  for (let i = 1; i < cells.length; i++) cur = move(cur, dirBetween(cur.level, cells[i - 1], cells[i]))
  return cur
}

describe('generation', () => {
  it('walls are consistent between neighbours and every cell is reachable', () => {
    for (const seed of ['a', 'b', 'c']) {
      const l = generate({ ...BASE, braid: 0.1 }, createRandom(seed))
      for (let i = 0; i < l.w * l.h; i++) for (const n of openNeighbours(l, i)) expect(openNeighbours(l, n)).toContain(i)
      expect(distances(l, 0).every((d) => d >= 0)).toBe(true)
    }
  })
  it('a perfect maze has exactly cells - 1 passages; braiding adds more', () => {
    const count = (l: Level) => Array.from({ length: l.w * l.h }, (_, i) => openNeighbours(l, i).length).reduce((a, b) => a + b, 0) / 2
    expect(count(generate(BASE, createRandom('p')))).toBe(80)
    expect(count(generate({ ...BASE, braid: 0.2 }, createRandom('p')))).toBeGreaterThan(80)
  })
  it('is deterministic for a seed and varies between seeds', () => {
    const a = generate(BASE, createRandom('same'))
    expect(generate(BASE, createRandom('same'))).toEqual(a)
    expect(generate(BASE, createRandom('other')).walls).not.toEqual(a.walls)
  })
  it('the exit is the farthest cell and par is the route length', () => {
    const l = generate(BASE, createRandom('x'))
    const d = distances(l, idx(l, l.start))
    expect(d[idx(l, l.exit)]).toBe(Math.max(...d))
    expect(l.par).toBe(d[idx(l, l.exit)])
  })
  it('items never share a cell and never sit on the start or exit', () => {
    const l = generate({ ...BASE, coins: 8, traps: 6, doors: 2, enemies: 3, powers: 3 }, createRandom('items'))
    const all = [...l.coins, ...l.keys, ...l.doors, ...l.traps, ...l.powers].map((p) => idx(l, p))
    expect(new Set(all).size).toBe(all.length)
    expect(all).not.toContain(idx(l, l.start))
    expect(all).not.toContain(idx(l, l.exit))
  })
})

describe('all 50 campaign levels', () => {
  it('exist, are solvable and match their mechanics schedule', () => {
    for (let n = 1; n <= CAMPAIGN_LEVELS; n++) {
      const l = campaignLevel(n)
      expect(isSolvable(l), `level ${n}`).toBe(true)
      expect(l.keys.length).toBe(l.doors.length)
    }
    expect(() => campaignLevel(0)).toThrow()
    expect(() => campaignLevel(51)).toThrow()
  })
  it('level 1 is a small plain maze and level 50 is the biggest with every mechanic', () => {
    const a = campaignLevel(1)
    expect([a.w, a.coins.length, a.traps.length, a.doors.length, a.enemies.length, a.timeLimitMs, a.fog]).toEqual([7, 0, 0, 0, 0, 0, 0])
    const z = campaignLevel(50)
    expect(z.w).toBe(21)
    expect(z.traps.length).toBeGreaterThan(0)
    expect(z.doors.length).toBeGreaterThan(0)
    expect(z.enemies.length).toBeGreaterThan(0)
    expect(z.powers.length).toBeGreaterThan(0)
  })
  it('gets harder: size, hazards and par never go down across tiers', () => {
    const tier = (n: number) => campaignConfig(n)
    for (let n = 2; n <= 50; n++) {
      expect(tier(n).w).toBeGreaterThanOrEqual(tier(n - 1).w)
      expect(tier(n).coins + tier(n).traps + tier(n).doors + tier(n).enemies).toBeGreaterThanOrEqual(tier(n - 1).coins + tier(n - 1).traps + tier(n - 1).doors + tier(n - 1).enemies)
    }
  })
  it('introduces new things gradually', () => {
    expect([1, 2, 4, 6, 9, 10, 11, 16, 20].every((n) => introduces(n) !== null)).toBe(true)
    expect(introduces(3)).toBeNull()
  })
  it('endless mazes are solvable for many indexes and seeds, and grow', () => {
    for (const seed of ['r1', 'r2']) for (let i = 0; i < 30; i++) expect(isSolvable(endlessLevel(seed, i))).toBe(true)
    expect(endlessLevel('r', 0).w).toBe(7)
    expect(endlessLevel('r', 40).w).toBe(21)
    expect(endlessLevel('r1', 3)).not.toEqual(endlessLevel('r2', 3))
  })
})

describe('moving', () => {
  const plain = () => generate(BASE, createRandom('m'))
  it('walls block and open passages move', () => {
    const l = plain()
    const s = newState(l)
    const open = openNeighbours(l, idx(l, l.start))
    const d = dirBetween(l, idx(l, l.start), open[0])
    expect(move(s, d).p).not.toEqual(l.start)
    const blocked = DIR_LIST.find((dd) => l.walls[idx(l, l.start)] & DIRS[dd].bit) as Dir
    expect(move(s, blocked)).toBe(s)
  })
  it('walking the shortest route wins', () => {
    const l = plain()
    const r = route(l, idx(l, l.start), idx(l, l.exit)) as number[]
    const s = walk(newState(l), r)
    expect(s.status).toBe('won')
    expect(s.steps).toBe(l.par)
    expect(move(s, 'up')).toBe(s)
  })
  it('collects coins, keys and opens doors only with a key', () => {
    const l = generate({ ...BASE, coins: 5, doors: 2 }, createRandom('door'))
    expect(l.doors.length).toBeGreaterThan(0)
    const r = route(l, idx(l, l.start), idx(l, l.exit)) as number[]
    const doorAt = r.findIndex((c) => l.doors.some((d) => idx(l, d) === c))
    const stuck = walk(newState({ ...l, keys: [] }), r.slice(0, doorAt + 1))
    expect(stuck.p).toEqual(at(l, r[doorAt - 1]))
    expect(stuck.events).toEqual(['locked'])
    // Give a key and the same step opens the door and uses the key.
    const keyed = walk({ ...newState({ ...l, keys: [] }), keys: 1 }, r.slice(0, doorAt + 1))
    expect(keyed.p).toEqual(at(l, r[doorAt]))
    expect(keyed.keys).toBe(0)
    expect(keyed.doorsLeft.length).toBe(l.doors.length - 1)
  })
  it('a full solve with items: collect every key, open every door, reach the exit', () => {
    for (const seed of ['s1', 's2', 's3', 's4']) {
      const l = generate({ ...BASE, w: 11, h: 11, doors: 3, coins: 4, braid: 0.05 }, createRandom(seed))
      let s = newState(l)
      const doorCells = new Set(l.doors.map((d) => idx(l, d)))
      for (const k of l.keys) s = walk(s, route(l, idx(l, s.p), idx(l, k), doorCells) as number[])
      expect(s.keys).toBe(l.keys.length)
      s = walk(s, route(l, idx(l, s.p), idx(l, l.exit)) as number[])
      expect(s.status).toBe('won')
      expect(s.doorsLeft).toEqual([])
    }
  })
  it('spikes cost a heart, then protect briefly; losing every heart loses', () => {
    const l = generate({ ...BASE, traps: 3 }, createRandom('trap'))
    const t = l.traps[0]
    const base = { ...newState(l, 2), p: l.start }
    const next = openNeighbours(l, idx(l, t))[0]
    let s: MState = { ...base, p: at(l, next) }
    s = move(s, dirBetween(l, next, idx(l, t)))
    expect(s.hearts).toBe(1)
    expect(s.events).toContain('hit')
    expect(s.effects.hurt).toBeGreaterThan(0)
    // Stepping off and on again while protected costs nothing.
    s = move(move(s, dirBetween(l, idx(l, t), next)), dirBetween(l, next, idx(l, t)))
    expect(s.hearts).toBe(1)
    s = tick(s, 2000, createRandom('t'))
    s = move(move(s, dirBetween(l, idx(l, t), next)), dirBetween(l, next, idx(l, t)))
    expect(s.hearts).toBe(0)
    expect(s.status).toBe('lost')
    expect(s.reason).toBe('hearts')
  })
  it('shield ignores spikes', () => {
    const l = generate({ ...BASE, traps: 3 }, createRandom('trap'))
    const t = l.traps[0]
    const next = openNeighbours(l, idx(l, t))[0]
    const s = move({ ...newState(l), p: at(l, next), effects: { speed: 0, shield: 5000, freeze: 0, hurt: 0 } }, dirBetween(l, next, idx(l, t)))
    expect(s.hearts).toBe(3)
  })
  it('power-ups: speed, shield, freeze, extra time and reveal', () => {
    const l = generate({ ...BASE, powers: 5 }, createRandom('pw'), )
    const cases: [string, (s: MState) => boolean][] = [
      ['speed', (s) => s.effects.speed > 0],
      ['shield', (s) => s.effects.shield > 0],
      ['freeze', (s) => s.effects.freeze > 0],
      ['time', (s) => (s.timeLeft ?? 0) > 20000],
      ['reveal', (s) => s.seen.filter(Boolean).length > 25],
    ]
    for (const [kind, ok] of cases) {
      const lv: Level = { ...l, timeLimitMs: 20000, fog: 2, powers: [{ ...at(l, openNeighbours(l, idx(l, l.start))[0]), kind: kind as 'speed' }] }
      const s = move(newState(lv), dirBetween(lv, idx(lv, lv.start), openNeighbours(lv, idx(lv, lv.start))[0]))
      expect(s.events).toContain('power')
      expect(ok(s), kind).toBe(true)
    }
  })
})

describe('time and enemies', () => {
  it('the clock runs out and loses', () => {
    const l = { ...generate(BASE, createRandom('c')), timeLimitMs: 3000 }
    let s = newState(l)
    s = tick(s, 2000, createRandom('t'))
    expect(s.status).toBe('playing')
    s = tick(s, 1500, createRandom('t'))
    expect(s.status).toBe('lost')
    expect(s.reason).toBe('time')
  })
  it('untimed levels have no clock', () => {
    expect(newState(generate(BASE, createRandom('c'))).timeLeft).toBeNull()
  })
  it('enemies walk, chase when close, and freeze', () => {
    const l = generate({ ...BASE, enemies: 1 }, createRandom('en'))
    const e = l.enemies[0]
    let s = newState(l)
    s = tick(s, 700, createRandom('e'))
    expect(s.enemies[0].x !== e.x || s.enemies[0].y !== e.y).toBe(true)
    const frozen = tick({ ...newState(l), effects: { speed: 0, shield: 0, freeze: 3000, hurt: 0 } }, 700, createRandom('e'))
    expect(frozen.enemies[0].x).toBe(e.x)
    expect(frozen.enemies[0].y).toBe(e.y)
    // Chase: put the player two cells from an enemy and let it close in.
    const r = route(l, idx(l, e), idx(l, l.start)) as number[]
    const near = r[Math.min(2, r.length - 1)]
    let c = { ...newState(l), p: at(l, near) }
    const before = distances(l, near)[idx(l, e)]
    c = tick(c, 700, createRandom('e'))
    expect(distances(l, near)[idx(c.level, c.enemies[0])]).toBeLessThan(before)
  })
  it('an enemy touching the player costs one heart, then protects', () => {
    const l = generate({ ...BASE, enemies: 1 }, createRandom('en'))
    const s = tick({ ...newState(l), p: { ...l.enemies[0] } }, 16, createRandom('e'))
    expect(s.hearts).toBe(2)
    expect(tick(s, 16, createRandom('e')).hearts).toBe(2)
  })
  it('toggling spikes alternate', () => {
    const t = { x: 0, y: 0, period: 1000, phase: 0 }
    expect(trapActive(t, 100)).toBe(true)
    expect(trapActive(t, 1100)).toBe(false)
    expect(trapActive({ ...t, period: 0 }, 1100)).toBe(true)
  })
})

describe('fog, scoring and difficulty', () => {
  it('fog hides far cells and walking reveals', () => {
    const l = { ...generate(BASE, createRandom('f')), fog: 2 }
    const s = newState(l)
    expect(s.seen.filter(Boolean).length).toBeLessThan(l.w * l.h)
    expect(newState({ ...l, fog: 0 }).seen.every(Boolean)).toBe(true)
  })
  it('stars: finish, all coins, under par time', () => {
    const l = generate({ ...BASE, coins: 2 }, createRandom('st'))
    const won = (extra: Partial<MState>): MState => ({ ...newState(l), status: 'won', ...extra })
    expect(stars(newState(l))).toBe(0)
    expect(stars(won({ coinsGot: 0, elapsed: parMs(l) + 1 }))).toBe(1)
    expect(stars(won({ coinsGot: 2, elapsed: parMs(l) + 1 }))).toBe(2)
    expect(stars(won({ coinsGot: 0, elapsed: 1 }))).toBe(2)
    expect(stars(won({ coinsGot: 2, elapsed: 1 }))).toBe(3)
    expect(score(won({ coinsGot: 2, elapsed: 1 }))).toBeGreaterThan(score(won({ coinsGot: 0, elapsed: parMs(l) + 1 })))
  })
  it('difficulty changes hearts, time and enemy speed but not the maze', () => {
    const l = campaignLevel(14)
    const e = startLevel(l, 'easy')
    const h = startLevel(l, 'hard')
    expect(e.hearts).toBe(DIFFICULTIES.easy.hearts)
    expect(h.hearts).toBe(2)
    expect((e.timeLeft ?? 0) > (h.timeLeft ?? 0)).toBe(true)
    expect(e.level.walls).toEqual(h.level.walls)
    expect(e.level.enemyMs).toBeGreaterThan(h.level.enemyMs)
  })
})

function at(l: { w: number }, i: number) {
  return { x: i % l.w, y: Math.floor(i / l.w) }
}
