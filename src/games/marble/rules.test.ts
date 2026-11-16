import { describe, expect, it } from 'vitest'
import { CELL, CHECK_CATCH, FALL_PENALTY, HOLE_CATCH, LEVELS, MARBLE_R, NO_TILT, WALL, centre, elapsed, newGame, open, pathBetween, scoreFor, start, step, type Level, type MState } from './rules'
import { autopilot, tiltFromKeys } from './solver'

const LEVEL_NAMES = Object.keys(LEVELS) as Level[]
const SEEDS = ['a', 'b', 'c', 'marble:0:easy', 'daily-2026-11-16', 'zz9', 'seed seven', 'q']

describe('maze generation', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    expect(newGame('normal', 'x')).toEqual(newGame('normal', 'x'))
    expect(newGame('normal', 'x').h).not.toEqual(newGame('normal', 'y').h)
  })
  for (const level of LEVEL_NAMES)
    it(`${level}: every maze is solvable, a spanning tree, and keeps the marble's space clear (BFS)`, () => {
      for (const seed of SEEDS) {
        const s = newGame(level, seed)
        const { cols, rows } = LEVELS[level]
        expect(s.cols * s.rows).toBe(cols * rows)
        // Every cell reachable from the start; a perfect maze has exactly cells - 1 openings.
        let openings = 0
        for (let r = 0; r < rows; r++)
          for (let c = 0; c < cols; c++) {
            expect(pathBetween(s, s.start, { c, r }), `${seed} cell ${c},${r}`).not.toBeNull()
            if (open(s, { c, r }, 1)) openings++
            if (open(s, { c, r }, 2)) openings++
          }
        expect(openings).toBe(cols * rows - 1)
        // The border is closed.
        for (let c = 0; c < cols; c++) {
          expect(s.h[c]).toBe(true)
          expect(s.h[rows * cols + c]).toBe(true)
        }
        // Route from start to goal; goal is the furthest cell.
        expect(s.path[0]).toEqual(s.start)
        expect(s.path[s.path.length - 1]).toEqual(s.goal)
        expect(s.path.length).toBeGreaterThanOrEqual(cols)
        // Holes: the right number, distinct, never on start, goal or a checkpoint, never at a turn of the route.
        expect(s.holes).toHaveLength(LEVELS[level].holes)
        const keys = [...s.holes, s.start, s.goal, ...s.checkpoints].map((k) => `${k.c},${k.r}`)
        expect(new Set(keys).size).toBe(keys.length)
        for (const h of s.holes) {
          const i = s.path.findIndex((p) => p.c === h.c && p.r === h.r)
          const turn = (j: number) => j > 0 && j < s.path.length - 1 && s.path[j - 1].c !== s.path[j + 1].c && s.path[j - 1].r !== s.path[j + 1].r
          if (i > 0) expect(turn(i) || turn(i - 1)).toBe(false)
        }
        // Checkpoints lie on the route, in order.
        const idx = s.checkpoints.map((k) => s.path.findIndex((p) => p.c === k.c && p.r === k.r))
        expect(idx.every((i) => i > 0)).toBe(true)
        expect([...idx].sort((a, b) => a - b)).toEqual(idx)
      }
    })
  it('a hole can always be passed with room to spare, and the marble fits a corridor', () => {
    const slack = (CELL - WALL) / 2 - MARBLE_R // how far from the corridor axis the marble centre can be
    expect(slack).toBeGreaterThan(HOLE_CATCH + 0.5)
    expect(CHECK_CATCH).toBeGreaterThan(0)
  })
})

describe('physics', () => {
  const play = (s: MState) => start(s)
  it('does nothing until the game starts, and stops once won', () => {
    const s = newGame('easy', 'p')
    expect(step(s, 1 / 120, { x: 1, y: 0 })).toBe(s)
    const won = { ...s, status: 'won' as const }
    expect(step(won, 1 / 120, { x: 1, y: 0 })).toBe(won)
  })
  it('tilting accelerates the marble that way, and it never leaves the maze', () => {
    let s = play(newGame('easy', 'p'))
    for (let i = 0; i < 600; i++) s = step(s, 1 / 120, { x: 1, y: 1 })
    expect(s.x).toBeGreaterThan(centre(s.start).x)
    expect(s.x).toBeGreaterThan(0)
    expect(s.y).toBeGreaterThan(0)
    expect(s.x).toBeLessThan(s.cols * CELL)
    expect(s.y).toBeLessThan(s.rows * CELL)
    expect(Math.hypot(s.vx, s.vy)).toBeLessThan(46)
  })
  it('walls stop and bounce it: pushing at the border never gets through', () => {
    let s = play(newGame('normal', 'wall'))
    for (let i = 0; i < 1200; i++) {
      s = step(s, 1 / 120, { x: -1, y: -1 })
      expect(s.x).toBeGreaterThanOrEqual(MARBLE_R + WALL / 2 - 1e-6)
      expect(s.y).toBeGreaterThanOrEqual(MARBLE_R + WALL / 2 - 1e-6)
    }
  })
  it('friction slows a rolling marble to a stop', () => {
    let s = play(newGame('easy', 'p'))
    for (let i = 0; i < 40; i++) s = step(s, 1 / 120, { x: 0, y: 1 })
    for (let i = 0; i < 2400; i++) s = step(s, 1 / 120, NO_TILT)
    expect(Math.hypot(s.vx, s.vy)).toBeLessThan(0.5)
  })
  it('is deterministic: the same inputs give the same run', () => {
    const run = () => {
      let s = play(newGame('hard', 'det'))
      for (let i = 0; i < 1500; i++) s = step(s, 1 / 120, { x: Math.sin(i / 50), y: Math.cos(i / 70) })
      return s
    }
    expect(run()).toEqual(run())
  })
  it('a hole sends the marble back to the start with a penalty, then to the last checkpoint', () => {
    let s = play(newGame('normal', 'hole'))
    const hole = s.holes[0]
    const p = centre(hole)
    s = { ...s, x: p.x + 0.1, y: p.y }
    s = step(s, 1 / 120, NO_TILT)
    expect(s.falls).toBe(1)
    expect(s.x).toBeCloseTo(centre(s.start).x)
    expect(elapsed(s)).toBeCloseTo(s.t + FALL_PENALTY)
    const cp = centre(s.checkpoints[0])
    s = { ...s, x: cp.x, y: cp.y }
    s = step(s, 1 / 120, NO_TILT)
    expect(s.cp).toBe(0)
    s = { ...s, x: p.x, y: p.y }
    s = step(s, 1 / 120, NO_TILT)
    expect(s.falls).toBe(2)
    expect(s.x).toBeCloseTo(cp.x)
    expect(s.y).toBeCloseTo(cp.y)
  })
  it('reaching the goal wins and scores more for a faster run and a harder maze', () => {
    let s = play(newGame('easy', 'goal'))
    const g = centre(s.goal)
    s = step({ ...s, x: g.x, y: g.y, t: 5 }, 1 / 120, NO_TILT)
    expect(s.status).toBe('won')
    const fast = scoreFor(s)
    expect(scoreFor({ ...s, t: s.par * 2 })).toBeLessThan(fast)
    expect(scoreFor({ ...s, falls: 3 })).toBeLessThan(fast)
    expect(scoreFor({ ...s, level: 'hard' })).toBeGreaterThan(fast)
    expect(scoreFor(newGame('easy', 'goal'))).toBe(0)
  })
})

describe('the autopilot rolls every kind of maze through to the goal', () => {
  for (const level of LEVEL_NAMES)
    it(level, () => {
      for (const seed of SEEDS.slice(0, level === 'easy' ? 8 : 5)) {
        let s = start(newGame(level, seed))
        // Control every 50 ms (six physics steps), as a player or the e2e bot would.
        for (let tick = 0; tick < 4000 && s.status === 'playing'; tick++) {
          const tilt = tiltFromKeys(autopilot(s))
          for (let i = 0; i < 6; i++) s = step(s, 1 / 120, tilt)
        }
        expect(s.status, `${level} ${seed} (falls ${s.falls}, t ${s.t.toFixed(0)})`).toBe('won')
        expect(s.falls).toBe(0)
      }
    })
})
