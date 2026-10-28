import { expect, test, type Page } from '@playwright/test'
import { createRandom } from '../src/lib/rng'
import { begin, newGame, step, tickMs, turn, type Dir, type SnakeState } from '../src/games/snake/rules'
import { expectRows, readTable } from './helpers'

// The page and a pure-rules model are driven in lockstep from the same seed. The model says exactly
// where the head must be after every move, so these tests assert the real game against the rules.

const KEYS: Record<Dir, string> = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }
const T0 = new Date('2026-10-28T10:00:00Z')

type Run = { state: SnakeState; random: ReturnType<typeof createRandom> }

/** Lets React finish rendering and flush effects (it schedules them on a real MessageChannel). */
const flush = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const channel = new MessageChannel()
        channel.port1.onmessage = () => resolve()
        channel.port2.postMessage(0)
      }),
  )

/** Opens a seeded game with the clock paused, so the snake only moves when the test says so. */
async function open(page: Page, seed: string): Promise<Run> {
  await page.clock.install({ time: T0 })
  await page.goto(`/play/neon-snake?seed=${seed}`)
  await expect(page.locator('.snake-seg')).toHaveCount(3)
  await page.clock.pauseAt(new Date(T0.getTime() + 30_000))
  const random = createRandom(seed)
  return { state: newGame(random), random }
}

/** Waits until the page shows the model's state. */
async function settle(page: Page, run: Run) {
  const { state } = run
  if (state.status === 'over' || state.status === 'won') {
    await expect(page.locator('.game-over')).toBeVisible()
  } else {
    const head = page.locator('.snake-seg.head')
    await expect(head).toHaveAttribute('data-x', String(state.snake[0].x))
    await expect(head).toHaveAttribute('data-y', String(state.snake[0].y))
    await expect(page.locator('.snake-seg')).toHaveCount(state.snake.length)
  }
  await flush(page)
}

/** Presses a direction, mirroring what the game does with it. */
async function press(page: Page, run: Run, dir: Dir) {
  run.state = begin(turn(run.state, dir))
  await page.keyboard.press(KEYS[dir])
  await flush(page)
}

/** One move: the model steps, the clock advances by that move's delay, the page must agree. */
async function tick(page: Page, run: Run, moves = 1) {
  for (let i = 0; i < moves; i++) {
    const delay = tickMs(run.state)
    run.state = step(run.state, run.random)
    await page.clock.runFor(delay)
    await settle(page, run)
  }
}

const foodAt = async (page: Page) => {
  const food = page.locator('.snake-food')
  return [Number(await food.getAttribute('data-x')), Number(await food.getAttribute('data-y'))]
}

test('eating grows the snake, scores, and deals the next food from the seeded stream', async ({ page }) => {
  // A seed whose food is a short trip away and not in the snake's own row: go vertical, then horizontal.
  const seed = Array.from({ length: 500 }, (_, i) => `e2e-eat-${i}`).find((s) => {
    const f = newGame(createRandom(s)).food!
    return f.y !== 9 && Math.abs(f.y - 9) + Math.abs(f.x - 9) <= 10
  })!
  const run = await open(page, seed)
  const food = run.state.food!

  const vertical: Dir = food.y < 9 ? 'up' : 'down'
  await press(page, run, vertical)
  await tick(page, run, Math.abs(food.y - 9))
  if (food.x !== 9) {
    await press(page, run, food.x > 9 ? 'right' : 'left')
    await tick(page, run, Math.abs(food.x - 9))
  }

  expect(run.state.eaten).toBe(1)
  await expect(page.getByText('Score', { exact: true }).locator('xpath=following-sibling::strong')).toHaveText('10')
  await expect(page.locator('.snake-seg')).toHaveCount(4) // grew from 3
  expect(await foodAt(page)).toEqual([run.state.food!.x, run.state.food!.y])
  await expectRows(page, 'history', 0) // still alive: nothing saved yet
})

test('crashing into a wall ends the run, saves it once, and a new run can follow', async ({ page }) => {
  const run = await open(page, 'e2e-wall')
  await press(page, run, 'right') // already heading right: this just starts the run
  while (run.state.status === 'playing') await tick(page, run)

  await expect(page.getByRole('heading', { name: 'Crashed' })).toBeVisible()
  const expected = run.state.eaten * 10
  await expectRows(page, 'history', 1)
  expect((await readTable(page, 'history'))[0]).toMatchObject({ gameId: 'neon-snake', score: expected, won: false })

  await page.clock.runFor(10_000) // a dead snake stays dead and records nothing more
  await expectRows(page, 'history', 1)

  await page.getByRole('button', { name: 'Play again' }).click()
  await expect(page.locator('.snake-seg')).toHaveCount(3)
  await expect(page.getByText(/Press an arrow key/)).toBeVisible()
  await expectRows(page, 'history', 1) // starting over does not record by itself
})

test('reversing is ignored, and a turn pressed mid-tick does not delay the move', async ({ page }) => {
  const run = await open(page, 'e2e-turns')
  await press(page, run, 'up')
  await tick(page, run)
  await press(page, run, 'down') // would fold the snake onto itself: ignored
  await tick(page, run)
  await expect(page.locator('.game-over')).toHaveCount(0)

  // A turn arrives 100ms into a 140ms tick; the move must still land at 140ms.
  await page.clock.runFor(100)
  await press(page, run, 'right')
  const delay = tickMs(run.state)
  run.state = step(run.state, run.random)
  await page.clock.runFor(delay - 100)
  await settle(page, run)
})

test('WASD steers too', async ({ page }) => {
  const run = await open(page, 'e2e-wasd')
  for (const [key, dir] of [['s', 'down'], ['d', 'right'], ['w', 'up'], ['a', 'left']] as const) {
    run.state = begin(turn(run.state, dir))
    await page.keyboard.press(key)
    await flush(page)
    await tick(page, run)
  }
  await expect(page.locator('.game-over')).toHaveCount(0)
})

test('pause freezes the snake; Space and the button resume it', async ({ page }) => {
  const run = await open(page, 'e2e-pause')
  await press(page, run, 'up')
  await tick(page, run, 2)

  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByText('Paused')).toBeVisible()
  await page.clock.runFor(5000)
  await settle(page, run) // unchanged: nothing moved while paused

  await page.keyboard.press(' ') // Space resumes
  await expect(page.getByText('Paused')).toHaveCount(0)
  await flush(page)
  await tick(page, run)

  await page.getByRole('button', { name: 'Pause' }).click()
  await page.getByRole('button', { name: 'Resume' }).click()
  await flush(page)
  await tick(page, run)
})

test('the same seed deals the same food, a different seed does not', async ({ page }) => {
  const foodFor = async (seed: string) => {
    await page.goto(`/play/neon-snake?seed=${seed}`)
    await expect(page.locator('.snake-food')).toBeVisible()
    return foodAt(page)
  }
  const a1 = await foodFor('e2e-same')
  const a2 = await foodFor('e2e-same')
  expect(a1).toEqual(a2)
  const model = newGame(createRandom('e2e-same')).food!
  expect(a1).toEqual([model.x, model.y])
  expect(await foodFor('e2e-different-seed')).not.toEqual(a1)
})

test.describe('touch', () => {
  test('swipes and the on-screen pad steer the snake', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch input')
    const run = await open(page, 'e2e-touch')

    const swipe = (dx: number, dy: number) =>
      page.locator('.snake-board').evaluate(
        (board, [moveX, moveY]) => {
          const rect = board.getBoundingClientRect()
          const x = rect.left + rect.width / 2
          const y = rect.top + rect.height / 2
          const touch = (cx: number, cy: number) => new Touch({ identifier: 1, target: board, clientX: cx, clientY: cy })
          const init = (list: Touch[]) => ({ bubbles: true, cancelable: true, touches: list, targetTouches: list, changedTouches: list })
          board.dispatchEvent(new TouchEvent('touchstart', init([touch(x, y)])))
          board.dispatchEvent(new TouchEvent('touchend', { ...init([]), changedTouches: [touch(x + moveX, y + moveY)] }))
        },
        [dx, dy],
      )

    run.state = begin(turn(run.state, 'up'))
    await swipe(4, -70) // a swipe up
    await flush(page)
    await tick(page, run)

    run.state = begin(turn(run.state, 'right'))
    await swipe(80, 6) // a swipe right
    await flush(page)
    await tick(page, run)

    run.state = begin(turn(run.state, 'down'))
    await page.getByRole('button', { name: 'Down', exact: true }).tap()
    await flush(page)
    await tick(page, run)

    // A tiny touch is a tap, not a swipe: it must not steer.
    await swipe(3, 3)
    await flush(page)
    await tick(page, run)
    await expect(page.locator('.game-over')).toHaveCount(0)
  })
})
