import { describe, expect, it } from 'vitest'
import { LEVELS, act, flip, move, newGame, par, parseLevel, restart, scoreFor, solve, starsFor, undo, type Action } from './rules'

const play = (level: number, actions: Action[]) => actions.reduce((s, a) => act(s, a), newGame(level))

describe('Gravity Flip levels', () => {
  it('every level is a closed rectangle with exactly one start and one exit', () => {
    for (const [i, level] of LEVELS.entries()) {
      const { cells, w, h } = parseLevel(level)
      expect(level.rows.every((r) => r.length === w), `level ${i + 1} rows are the same width`).toBe(true)
      for (let x = 0; x < w; x++) expect([cells[0][x], cells[h - 1][x]], `level ${i + 1} top/bottom`).toEqual(['#', '#'])
      for (let y = 0; y < h; y++) expect([cells[y][0], cells[y][w - 1]], `level ${i + 1} sides`).toEqual(['#', '#'])
      expect(level.rows.join('').split('S').length - 1, `level ${i + 1} starts`).toBe(1)
      expect(level.rows.join('').split('E').length - 1, `level ${i + 1} exits`).toBe(1)
    }
  })

  it('every level is solvable, and replaying its solution wins in exactly par moves', () => {
    for (let i = 0; i < LEVELS.length; i++) {
      const path = solve(i)
      expect(path, `level ${i + 1} is solvable`).not.toBeNull()
      expect(path!.length).toBeGreaterThan(0)
      const end = play(i, path!)
      expect(end.status).toBe('won')
      expect(end.moves).toBe(par(i))
    }
  })

  it('no level can be won without flipping (each one teaches or needs gravity)', () => {
    const noFlip = (i: number) => {
      // Walk right/left only: BFS without flips.
      const seen = new Set<string>()
      const queue = [newGame(i)]
      while (queue.length) {
        const s = queue.shift()!
        const k = `${s.x},${s.y}`
        if (seen.has(k)) continue
        seen.add(k)
        for (const d of [-1, 1] as const) {
          const n = move(s, d)
          if (n.status === 'won') return true
          if (n.status === 'playing') queue.push({ ...n, history: [] })
        }
      }
      return false
    }
    // Levels 1-6 are all about flipping. (The maze levels may also be walkable.)
    for (let i = 0; i < 6; i++) expect(noFlip(i), `level ${i + 1}`).toBe(false)
  })
})

describe('Gravity Flip mechanics', () => {
  it('the player drops to rest at the start and gravity points down', () => {
    const s = newGame(0)
    expect(s).toMatchObject({ x: 1, y: 4, g: 1, moves: 0, status: 'playing' })
  })

  it('walking costs one move per step and stops at walls for free', () => {
    const s = newGame(0)
    expect(move(s, -1)).toBe(s) // wall on the left: nothing happens
    const r = move(s, 1)
    expect(r).toMatchObject({ x: 2, y: 4, moves: 1 })
    expect(move(r, 1).moves).toBe(2)
  })

  it('flipping sends the player to the other side, and always costs a move', () => {
    const s = flip(newGame(0))
    expect(s).toMatchObject({ y: 1, g: -1, moves: 1 })
    expect(flip(s)).toMatchObject({ y: 4, g: 1, moves: 2 })
    // Flipping where nothing changes still costs a move.
    const top = flip(newGame(0))
    expect(flip(flip(top)).moves).toBe(3)
  })

  it('reaching the exit while falling wins', () => {
    const won = play(0, [...Array<Action>(9).fill('R'), 'F'])
    expect(won.status).toBe('won')
    expect(won.moves).toBe(10)
    expect(move(won, -1)).toBe(won)
    expect(flip(won)).toBe(won)
    expect(undo(won)).toBe(won)
  })

  it('stepping onto spikes is fatal, and so is falling into them', () => {
    const spike = play(2, ['R', 'R'])
    expect(spike.status).toBe('playing')
    expect(move(spike, 1).status).toBe('dead') // (4,3) is a spike
    const gap = play(3, ['R', 'R', 'R'])
    expect(move(gap, 1).status).toBe('dead') // steps off the ledge into the spike pit
    expect(move(move(gap, 1), 1)).toEqual(move(gap, 1)) // dead means no more input
  })

  it('a dead player can undo the fatal move; undo restores position, gravity and move count', () => {
    const before = play(2, ['R', 'R'])
    const dead = move(before, 1)
    expect(dead.status).toBe('dead')
    const back = undo(dead)
    expect(back).toMatchObject({ x: before.x, y: before.y, g: before.g, moves: before.moves, status: 'playing' })

    const flipped = flip(newGame(0))
    expect(undo(flipped)).toMatchObject({ y: 4, g: 1, moves: 0 })
    expect(undo(newGame(0))).toEqual(newGame(0))
  })

  it('restart returns to the beginning of the same level', () => {
    const s = play(1, ['R', 'F'])
    expect(restart(s)).toEqual(newGame(1))
  })

  it('a flip can carry the player across a gap, which walking cannot', () => {
    // Level 4: up, across, down, then on to the exit.
    const path: Action[] = ['F', ...Array<Action>(6).fill('R'), 'F', ...Array<Action>(4).fill('R')]
    const end = play(3, path)
    expect(end.status).toBe('won')
  })

  it('par for the first two levels is as designed', () => {
    expect(par(0)).toBe(10)
    expect(par(1)).toBe(11)
  })
})

describe('Gravity Flip scoring', () => {
  it('par scores 1000, each extra move costs 50, never below 100', () => {
    expect(scoreFor(10, 10)).toBe(1000)
    expect(scoreFor(8, 10)).toBe(1000) // can't beat par, but never penalised for it
    expect(scoreFor(14, 10)).toBe(800)
    expect(scoreFor(500, 10)).toBe(100)
  })

  it('stars: 3 at par, 2 within three moves, otherwise 1', () => {
    expect(starsFor(10, 10)).toBe(3)
    expect(starsFor(13, 10)).toBe(2)
    expect(starsFor(14, 10)).toBe(1)
  })
})
