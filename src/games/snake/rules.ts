import type { Random } from '../../lib/rng'

/** Pure Snake rules: no React, timers or browser APIs, so a server can reuse them to validate runs. */

export type Dir = 'up' | 'down' | 'left' | 'right'
export type Point = { x: number; y: number }
export type Status = 'ready' | 'playing' | 'over' | 'won'

export type SnakeState = {
  cols: number
  rows: number
  /** Head first. */
  snake: Point[]
  /** Direction of the last move. */
  dir: Dir
  /** Turns waiting for the next ticks, at most two, so quick key presses are not lost. */
  queue: Dir[]
  /** Null only once the board is completely full. */
  food: Point | null
  eaten: number
  status: Status
}

export const SIZE = 18
export const POINTS_PER_FOOD = 10

const DELTA: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

export const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }

export const score = (state: SnakeState): number => state.eaten * POINTS_PER_FOOD

/** Milliseconds per move: starts relaxed, speeds up with every food, never faster than 70ms. */
export const tickMs = (state: Pick<SnakeState, 'eaten'>): number => Math.max(70, 140 - state.eaten * 4)

const freeCells = (cols: number, rows: number, snake: Point[]): Point[] => {
  const taken = new Set(snake.map((p) => p.y * cols + p.x))
  const free: Point[] = []
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (!taken.has(y * cols + x)) free.push({ x, y })
  return free
}

function placeFood(cols: number, rows: number, snake: Point[], random: Random): Point | null {
  const free = freeCells(cols, rows, snake)
  return free.length ? free[Math.floor(random() * free.length)] : null
}

/** A three-segment snake in the middle of the board, heading right, waiting to start. */
export function newGame(random: Random = Math.random, cols = SIZE, rows = SIZE): SnakeState {
  const x = Math.floor(cols / 2)
  const y = Math.floor(rows / 2)
  const snake = [{ x, y }, { x: x - 1, y }, { x: x - 2, y }]
  return { cols, rows, snake, dir: 'right', queue: [], food: placeFood(cols, rows, snake, random), eaten: 0, status: 'ready' }
}

export function begin(state: SnakeState): SnakeState {
  return state.status === 'ready' ? { ...state, status: 'playing' } : state
}

/**
 * Queues a turn. Reversing into the body and repeating the current heading are ignored, judged
 * against the last queued turn, so "up, left" pressed within one tick plays out as two moves.
 * Returns the same object when the input is ignored.
 */
export function turn(state: SnakeState, dir: Dir): SnakeState {
  if (state.status === 'over' || state.status === 'won') return state
  const last = state.queue.length ? state.queue[state.queue.length - 1] : state.dir
  if (dir === last || dir === OPPOSITE[last] || state.queue.length >= 2) return state
  return { ...state, queue: [...state.queue, dir] }
}

/** Advances one move. Does nothing unless the game is playing. */
export function step(state: SnakeState, random: Random = Math.random): SnakeState {
  if (state.status !== 'playing') return state
  const [queued, ...queue] = state.queue
  const dir = queued ?? state.dir
  const head = state.snake[0]
  const next = { x: head.x + DELTA[dir].x, y: head.y + DELTA[dir].y }
  const base = { ...state, dir, queue }

  if (next.x < 0 || next.x >= state.cols || next.y < 0 || next.y >= state.rows) return { ...base, status: 'over' }

  const eating = state.food !== null && next.x === state.food.x && next.y === state.food.y
  // The tail cell is free to enter unless the snake is growing and keeps it.
  const body = eating ? state.snake : state.snake.slice(0, -1)
  if (body.some((p) => p.x === next.x && p.y === next.y)) return { ...base, status: 'over' }

  const snake = [next, ...body]
  if (!eating) return { ...base, snake }

  const food = placeFood(state.cols, state.rows, snake, random)
  return { ...base, snake, food, eaten: state.eaten + 1, status: food ? 'playing' : 'won' }
}
