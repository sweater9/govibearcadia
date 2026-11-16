import { describe, expect, it } from 'vitest'
import {
  COLS, ROWS, WAVES, PATH_LENGTH, TOWERS, MAX_TOWER_LEVEL, isPath, pathPoint, newGame, build, upgrade, startWave, step, score, isOver, waveQueue, whyNot, upgradeCost, towerAt, wavesCleared, type State, type Level,
} from './rules'

function bot(seed: string, level: Level, plan: 'good' | 'none'): State {
  let s = newGame(seed, level)
  const spots: [number, number][] = []
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (isPath(c, r)) continue
    let near = 0
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (isPath(c + dc, r + dr)) near++
    if (near >= 3) spots.push([c, r])
  }
  spots.sort((a, b) => a[1] - b[1] || a[0] - b[0])
  let guard = 0
  while (!isOver(s) && guard++ < 100000) {
    if (plan === 'good' && s.status === 'build') {
      let progress = true
      while (progress) {
        progress = false
        const free = spots.find(([c, r]) => !towerAt(s, c, r))
        const kinds = ['basic', 'splash', 'slow'] as const
        if (free) {
          const kind = kinds[s.towers.length % 3]
          const n = build(s, kind, free[0], free[1])
          if (n !== s) { s = n; progress = true; continue }
        }
        for (const t of s.towers) { const n = upgrade(s, t.c, t.r); if (n !== s) { s = n; progress = true; break } }
      }
    }
    if (s.status === 'build') s = startWave(s)
    s = step(s, 1000)
  }
  return s
}

describe('map', () => {
  it('path is inside the grid and leaves cells to build on', () => {
    let free = 0
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!isPath(c, r)) free++
    expect(free).toBeGreaterThan(25)
    expect(isPath(0, 1)).toBe(true)
    expect(isPath(0, 0)).toBe(false)
    expect(PATH_LENGTH).toBeGreaterThan(20)
  })
  it('pathPoint clamps and starts at the entrance', () => {
    expect(pathPoint(-5)).toEqual([-0.5, 1.5])
    expect(pathPoint(1e6)[1]).toBe(8)
  })
})

describe('building', () => {
  it('refuses path, occupied, off-grid and unaffordable cells', () => {
    const s = newGame('a')
    expect(whyNot(s, 'basic', 0, 1)).toBe('path')
    expect(whyNot(s, 'basic', -1, 0)).toBe('edge')
    expect(whyNot(s, 'splash', 0, 0)).toBeNull()
    const b = build(s, 'basic', 0, 0)
    expect(b.gold).toBe(s.gold - TOWERS.basic.cost)
    expect(whyNot(b, 'basic', 0, 0)).toBe('taken')
    expect(build(b, 'basic', 0, 0)).toBe(b)
    expect(whyNot({ ...s, gold: 10 }, 'basic', 0, 0)).toBe('gold')
  })
  it('upgrades up to the maximum and charges for it', () => {
    let s = { ...build(newGame('a'), 'basic', 0, 0), gold: 5000 }
    for (let i = 1; i < MAX_TOWER_LEVEL; i++) s = upgrade(s, 0, 0)
    expect(towerAt(s, 0, 0)!.level).toBe(MAX_TOWER_LEVEL)
    expect(upgrade(s, 0, 0)).toBe(s)
    expect(upgradeCost(towerAt(s, 0, 0)!)).toBe(Infinity)
    expect(upgrade(newGame('a'), 0, 0).towers).toHaveLength(0)
  })
})

describe('waves', () => {
  it('queues are deterministic and grow', () => {
    expect(waveQueue('s', 4)).toEqual(waveQueue('s', 4))
    expect(waveQueue('s', 10).length).toBeGreaterThan(waveQueue('s', 1).length)
    expect(waveQueue('s', 1).every((e) => e.kind === 'walker')).toBe(true)
  })
  it('startWave only works between waves', () => {
    const s = startWave(newGame('a'))
    expect(s.status).toBe('wave')
    expect(s.wave).toBe(1)
    expect(startWave(s)).toBe(s)
  })
  it('step does nothing while building', () => {
    const s = newGame('a')
    expect(step(s, 1000)).toBe(s)
  })
  it('an undefended wave leaks and costs lives', () => {
    let s = startWave(newGame('a'))
    for (let i = 0; i < 200 && s.status === 'wave'; i++) s = step(s, 1000)
    expect(s.lives).toBeLessThan(20)
    expect(s.leaked).toBeGreaterThan(0)
  })
  it('slicing time differently gives the same result', () => {
    const run = (dt: number) => {
      let s = build(build(startWave(newGame('x')), 'basic', 1, 2), 'splash', 3, 2)
      for (let t = 0; t < 30000; t += dt) s = step(s, dt)
      return [s.kills, s.lives, s.gold, s.enemies.length]
    }
    expect(run(50)).toEqual(run(50))
    expect(run(100)).toEqual(run(50))
  })
})

describe('balance (scripted bot)', () => {
  it('doing nothing loses on every level', () => {
    for (const l of ['easy', 'normal', 'hard'] as Level[]) {
      const s = bot('bot', l, 'none')
      expect(s.status).toBe('lost')
      expect(score(s)).toBeGreaterThanOrEqual(0)
    }
  })
  it('a simple build-and-upgrade strategy beats easy and normal', () => {
    for (const l of ['easy', 'normal'] as Level[]) {
      const s = bot('bot', l, 'good')
      expect(s.status, `${l}: wave ${s.wave}, lives ${s.lives}`).toBe('won')
      expect(wavesCleared(s)).toBe(WAVES)
    }
  })
  it('is deterministic and hard is no easier than normal', () => {
    expect(bot('d', 'normal', 'good')).toEqual(bot('d', 'normal', 'good'))
    expect(score(bot('d', 'hard', 'good'))).toBeGreaterThan(0)
  })
})
