import { expect, test, type Page } from '@playwright/test'
import { createRandom } from '../src/lib/rng'
import { cellsOf, newGame, scoreFor } from '../src/games/carve/rules'
import { expectRows, readTable } from './helpers'

// The seeded puzzle's solution is computed with the pure rules, then carved with real drags.

const SEED = 'e2e-carve'
const T0 = new Date('2026-10-28T10:00:00Z')
const model = () => newGame(5, createRandom(SEED))

async function open(page: Page) {
  await page.clock.install({ time: T0 })
  await page.goto(`/play/carve?seed=${SEED}`)
  await expect(page.locator('.cv-board')).toBeVisible()
  await page.clock.setFixedTime(T0)
}

const centre = async (page: Page, cell: number) => {
  const box = (await page.locator(`[data-cell="${cell}"]`).boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
async function drag(page: Page, from: number, to: number) {
  const a = await centre(page, from)
  const b = await centre(page, to)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 4 })
  await page.mouse.up()
}

test('carving the seeded solution with real drags saves the right score', async ({ page }) => {
  const m = model()
  await open(page)
  const rects = m.puzzle.solution
  const span = (r: (typeof rects)[number]) => {
    const c = cellsOf(r, 5)
    return [c[0], c[c.length - 1]] as const
  }
  await drag(page, ...span(rects[0]))
  await page.clock.setFixedTime(new Date(T0.getTime() + 30_000))
  for (const r of rects.slice(1)) await drag(page, ...span(r))
  await expect(page.getByText(/Carved in 30s/)).toBeVisible()
  await expectRows(page, 'history', 1)
  expect((await readTable(page, 'history'))[0]).toMatchObject({ gameId: 'carve', won: true, score: scoreFor(30) })
})

test('a drag makes a piece, a tap removes it, and Reset clears everything', async ({ page }) => {
  await open(page)
  await drag(page, 0, 6)
  await expect(page.locator('[data-piece]')).toHaveCount(4)
  await drag(page, 0, 0)
  await expect(page.locator('[data-piece]')).toHaveCount(0)
  await drag(page, 0, 1)
  await drag(page, 10, 11)
  await expect(page.getByLabel('Pieces')).toHaveText('2')
  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(page.locator('[data-piece]')).toHaveCount(0)
  await expectRows(page, 'history', 0)
})

test('a piece with the wrong area is marked, and the same seed deals the same board', async ({ page }) => {
  const m = model()
  await open(page)
  const numbered = Object.keys(m.puzzle.numbers).map(Number)
  const lone = numbered.find((c) => m.puzzle.numbers[c] !== 1)!
  await drag(page, lone, lone) // a 1x1 piece on a number that is not 1
  await expect(page.locator(`[data-cell="${lone}"]`)).toHaveClass(/bad/)
  await page.reload()
  await expect(page.locator(`[data-cell="${lone}"]`)).toHaveText(String(m.puzzle.numbers[lone]))
})
