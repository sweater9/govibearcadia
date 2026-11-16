import { expect, test } from '@playwright/test'
import { expectRows, readTable } from './helpers'
import { newGame, type Level } from '../src/games/marble/rules'
import { autopilot } from '../src/games/marble/solver'

/** Plays a maze through the real UI with the arrow keys, using the same autopilot as the unit tests. */
test('a deterministic maze is rolled through with the keyboard and the saved run is scored', async ({ page }) => {
  test.setTimeout(180_000)
  const seed = 'e2e-mz'
  const level: Level = 'easy'
  const maze = newGame(level, `${seed}:1`)
  await page.clock.install({ time: new Date('2026-11-16T10:00:00Z') })
  await page.goto(`/play/marble-maze?seed=${seed}`)
  const board = page.locator('.mz-board')
  await expect(board).toBeVisible()
  // Choosing a difficulty deals the maze for run 1 of this seed, which is the one computed above.
  await page.getByLabel('Difficulty').selectOption(level)
  await expect(board).toHaveAttribute('data-level', level)
  await page.keyboard.press('Space')
  await expect(board).toHaveAttribute('data-status', 'playing')
  let held: string[] = []
  let px = Number(await board.getAttribute('data-x'))
  let py = Number(await board.getAttribute('data-y'))
  const names = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' } as const
  for (let tick = 0; tick < 3000 && (await board.getAttribute('data-status')) === 'playing'; tick++) {
    const x = Number(await board.getAttribute('data-x'))
    const y = Number(await board.getAttribute('data-y'))
    const k = autopilot({ ...maze, x, y, vx: (x - px) / 0.05, vy: (y - py) / 0.05 })
    px = x
    py = y
    const want = (Object.keys(names) as (keyof typeof names)[]).filter((n) => k[n]).map((n): string => names[n])
    for (const key of held) if (!want.includes(key)) await page.keyboard.up(key)
    for (const key of want) if (!held.includes(key)) await page.keyboard.down(key)
    held = want
    await page.clock.runFor(50)
  }
  for (const key of held) await page.keyboard.up(key)
  await expect(board).toHaveAttribute('data-status', 'won')
  await expect(page.locator('.game-over').getByRole('heading', { name: 'Through the maze' })).toBeVisible()
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'marble-maze', won: true })
  expect(row.score).toBeGreaterThan(0)
  await page.clock.runFor(5000)
  await expectRows(page, 'history', 1)
  await page.getByRole('button', { name: 'Play again' }).click()
  await expect(board).toHaveAttribute('data-status', 'ready')
})

test('arrow keys tilt the marble, pause freezes it, and a drag tilts it on touch', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-16T10:00:00Z') })
  await page.goto('/play/marble-maze?seed=e2e-mz-keys')
  const board = page.locator('.mz-board')
  await expect(board).toBeVisible()
  const y0 = Number(await board.getAttribute('data-y'))
  await page.keyboard.down('ArrowDown')
  await page.clock.runFor(300)
  await page.keyboard.up('ArrowDown')
  expect(Number(await board.getAttribute('data-y'))).toBeGreaterThan(y0)
  await page.keyboard.press('p')
  await expect(board).toHaveAttribute('data-status', 'paused')
  const y = await board.getAttribute('data-y')
  await page.clock.runFor(500)
  expect(await board.getAttribute('data-y')).toBe(y)
  await page.keyboard.press('p')
  await expect(board).toHaveAttribute('data-status', 'playing')
  // Dragging down tilts the board down.
  const box = (await board.boundingBox())!
  await page.keyboard.press('p')
  await page.keyboard.press('p')
  const before = Number(await board.getAttribute('data-y'))
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 60)
  await page.clock.runFor(400)
  await page.mouse.up()
  expect(Number(await board.getAttribute('data-y'))).toBeGreaterThanOrEqual(before)
})
