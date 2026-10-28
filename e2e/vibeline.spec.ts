import { expect, test, type Page } from '@playwright/test'
import { createRandom } from '../src/lib/rng'
import { newGame, scoreFor } from '../src/games/vibeline/rules'
import { expectRows, readTable } from './helpers'

// The seeded puzzle's solution is computed with the pure rules, then drawn with a real mouse/touch-style drag.

const SEED = 'e2e-vibeline'
const T0 = new Date('2026-10-28T10:00:00Z')
const solution = () => newGame(5, createRandom(SEED)).puzzle.solution

async function open(page: Page) {
  await page.clock.install({ time: T0 })
  await page.goto(`/play/vibeline?seed=${SEED}`)
  await expect(page.locator('.vl-board')).toBeVisible()
  await page.clock.setFixedTime(T0)
}

const centre = async (page: Page, cell: number) => {
  const box = (await page.locator(`[data-cell="${cell}"]`).boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/** Presses on the first cell and drags through the rest. */
async function drag(page: Page, cells: number[], afterSecondCell?: () => Promise<void>) {
  const first = await centre(page, cells[0])
  await page.mouse.move(first.x, first.y)
  await page.mouse.down()
  for (const [i, c] of cells.slice(1).entries()) {
    const p = await centre(page, c)
    await page.mouse.move(p.x, p.y, { steps: 4 })
    if (i === 0) await afterSecondCell?.() // the clock starts on the first step
  }
  await page.mouse.up()
}

test('dragging the whole solution saves the run with the right score', async ({ page }) => {
  await open(page)
  const sol = solution()
  await drag(page, sol, () => page.clock.setFixedTime(new Date(T0.getTime() + 10_000)))
  await expect(page.getByText(/Line complete in 10s/)).toBeVisible()
  await expectRows(page, 'history', 1)
  expect((await readTable(page, 'history'))[0]).toMatchObject({ gameId: 'vibeline', won: true, score: scoreFor(10) })
})

test('a partial drag draws on the board; Undo and Reset take it back', async ({ page }) => {
  await open(page)
  const sol = solution()
  await drag(page, sol.slice(0, 4))
  await expect(page.locator('[data-on]')).toHaveCount(4)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.locator('[data-on]')).toHaveCount(3)
  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(page.locator('[data-on]')).toHaveCount(1)
  await expectRows(page, 'history', 0)
})

test('dragging off the rules (a jump over cells) does not draw', async ({ page }) => {
  await open(page)
  const sol = solution()
  await drag(page, [sol[0], sol[10]])
  await expect(page.locator('[data-on]')).toHaveCount(1)
})

test('arrow keys draw the line, and the same seed deals the same board', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'keyboard input')
  await open(page)
  const sol = solution()
  await page.locator('.vl-board').focus()
  const n = 5
  for (let i = 1; i < 3; i++) {
    const d = sol[i] - sol[i - 1]
    await page.keyboard.press(d === 1 ? 'ArrowRight' : d === -1 ? 'ArrowLeft' : d === n ? 'ArrowDown' : 'ArrowUp')
  }
  await expect(page.locator('[data-on]')).toHaveCount(3)
  await page.reload()
  await expect(page.locator('[data-on]')).toHaveCount(1)
  await expect(page.locator(`[data-cell="${sol[0]}"] .vl-num`)).toHaveText('1')
})
