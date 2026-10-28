import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { POINTS_PER_FOOD, SIZE, begin, newGame, score, step, tickMs, turn, type Dir, type Point, type SnakeState } from './rules'

const playing = (state: SnakeState): SnakeState => begin(state)

/** A hand-built state, so rules can be checked without depending on the RNG. */
function fixed(snake: Point[], food: Point | null, extra: Partial<SnakeState> = {}): SnakeState {
  return { cols: 6, rows: 6, snake, dir: 'right', queue: [], food, eaten: 0, status: 'playing', ...extra }
}

describe('new game', () => {
  it('starts centred with three segments, heading right, waiting to start', () => {
    const state = newGame(createRandom('start'))
    expect(state.status).toBe('ready')
    expect(state.dir).toBe('right')
    expect(state.snake).toEqual([{ x: 9, y: 9 }, { x: 8, y: 9 }, { x: 7, y: 9 }])
    expect(state.cols).toBe(SIZE)
    expect(score(state)).toBe(0)
  })

  it('puts the food on a free cell, and deterministically for a seed', () => {
    for (let i = 0; i < 100; i++) {
      const { food, snake } = newGame(createRandom(`food-${i}`))
      expect(food).not.toBeNull()
      expect(snake.some((p) => p.x === food!.x && p.y === food!.y)).toBe(false)
    }
    expect(newGame(createRandom('same'))).toEqual(newGame(createRandom('same')))
    expect(newGame(createRandom('one')).food).not.toEqual(newGame(createRandom('two')).food)
  })

  it('does not move until it is started', () => {
    const state = newGame(createRandom('idle'))
    expect(step(state)).toBe(state)
    expect(begin(state).status).toBe('playing')
    expect(begin(begin(state)).status).toBe('playing')
  })
})

describe('moving', () => {
  it('moves one cell forward and keeps its length', () => {
    const state = playing(newGame(createRandom('move')))
    const next = step(state)
    expect(next.snake).toHaveLength(3)
    expect(next.snake[0]).toEqual({ x: 10, y: 9 })
    expect(next.snake[2]).toEqual({ x: 8, y: 9 })
    expect(next.status).toBe('playing')
  })

  it('does not mutate the previous state', () => {
    const state = playing(newGame(createRandom('pure')))
    const snapshot = JSON.stringify(state)
    step(state)
    turn(state, 'up')
    expect(JSON.stringify(state)).toBe(snapshot)
  })
})

describe('turning', () => {
  const start = () => playing(newGame(createRandom('turn')))

  it('turns on the next step', () => {
    const next = step(turn(start(), 'up'))
    expect(next.dir).toBe('up')
    expect(next.snake[0]).toEqual({ x: 9, y: 8 })
  })

  it('ignores reversing into the body and repeating the heading', () => {
    const state = start()
    expect(turn(state, 'left')).toBe(state)
    expect(turn(state, 'right')).toBe(state)
  })

  it('judges a turn against the last queued turn, so up-then-left works within one tick', () => {
    let state = turn(start(), 'up')
    state = turn(state, 'left')
    expect(state.queue).toEqual(['up', 'left'])
    state = step(step(state))
    expect(state.snake[0]).toEqual({ x: 8, y: 8 })
    expect(state.status).toBe('playing')
  })

  it('refuses an immediate reversal even when pressed twice quickly (up, down)', () => {
    const state = turn(turn(start(), 'up'), 'down')
    expect(state.queue).toEqual(['up'])
  })

  it('queues at most two turns', () => {
    let state = turn(start(), 'up')
    state = turn(state, 'left')
    const full = turn(state, 'down')
    expect(full).toBe(state)
  })

  it('is ignored once the game is over', () => {
    const over = { ...start(), status: 'over' as const }
    expect(turn(over, 'up')).toBe(over)
    expect(step(over)).toBe(over)
  })
})

describe('eating', () => {
  it('grows by one, scores, and places new food on a free cell', () => {
    const state = fixed([{ x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 }], { x: 3, y: 2 })
    const next = step(state, createRandom('eat'))
    expect(next.snake).toHaveLength(4)
    expect(next.snake[0]).toEqual({ x: 3, y: 2 })
    expect(next.eaten).toBe(1)
    expect(score(next)).toBe(POINTS_PER_FOOD)
    expect(next.food).not.toEqual({ x: 3, y: 2 })
    expect(next.snake.some((p) => p.x === next.food!.x && p.y === next.food!.y)).toBe(false)
  })

  it('wins when the snake fills the whole board', () => {
    // A 2x2 board: three segments and the last free cell holds the food.
    const state: SnakeState = {
      cols: 2,
      rows: 2,
      snake: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
      dir: 'up',
      queue: ['right'],
      food: { x: 1, y: 0 },
      eaten: 0,
      status: 'playing',
    }
    const won = step(state)
    expect(won.status).toBe('won')
    expect(won.food).toBeNull()
    expect(won.snake).toHaveLength(4)
  })
})

describe('crashing', () => {
  it.each<[Dir, Point]>([
    ['up', { x: 2, y: 0 }],
    ['down', { x: 2, y: 5 }],
    ['left', { x: 0, y: 2 }],
    ['right', { x: 5, y: 2 }],
  ])('ends the game at the %s wall', (dir, head) => {
    const state = fixed([head, { x: 3, y: 3 }], null, { dir })
    expect(step(state).status).toBe('over')
  })

  it('ends the game when the head hits the body', () => {
    // A tight curl: heading up into its own side.
    const snake = [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }]
    const state = fixed(snake, null, { dir: 'left', queue: ['down'] })
    expect(step(state).status).toBe('over')
  })

  it('lets the head follow into the cell the tail is leaving', () => {
    // A 2x2 loop: the head moves into the cell the tail vacates this very step.
    const snake = [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 1 }]
    const state = fixed(snake, null, { dir: 'up', queue: ['right'] })
    const next = step(state)
    expect(next.status).toBe('playing')
    expect(next.snake[0]).toEqual({ x: 2, y: 1 })
  })

  it('does not let the head into the tail cell when it is growing', () => {
    const snake = [{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 1 }]
    const state = fixed(snake, { x: 2, y: 1 }, { dir: 'up', queue: ['right'] })
    expect(step(state).status).toBe('over')
  })
})

describe('speed and score', () => {
  it('speeds up with each food and has a floor', () => {
    const base = newGame(createRandom('speed'))
    expect(tickMs(base)).toBe(140)
    expect(tickMs({ ...base, eaten: 5 })).toBeLessThan(tickMs(base))
    expect(tickMs({ ...base, eaten: 500 })).toBe(70)
  })

  it('is deterministic for a seed when the same inputs are played', () => {
    const play = () => {
      const random = createRandom('replay')
      let state = begin(newGame(random))
      const inputs: Dir[] = ['up', 'right', 'down', 'right', 'up']
      for (let i = 0; i < 30 && state.status === 'playing'; i++) {
        if (i % 6 === 0) state = turn(state, inputs[(i / 6) % inputs.length])
        state = step(state, random)
      }
      return state
    }
    expect(play()).toEqual(play())
  })
})
