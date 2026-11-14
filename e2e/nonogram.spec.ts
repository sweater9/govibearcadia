import { expect, test } from '@playwright/test'
import { newPuzzle } from '../src/games/nonogram/rules'
import { expectRows, readTable } from './helpers'

// `?seed=` deals the same picture every time and the rules are pure TypeScript, so the test knows the answer.
const SEED = 'e2e-nono'
const puzzle = newPuzzle(`${SEED}:5`, 5)
const cell = (r: number, c: number) => `button[aria-label^="Row ${r + 1}, column ${c + 1}:"]`

test('filling in the picture wins and saves the result once', async ({ page }) => {
  await page.goto(`/play/nonogram?seed=${SEED}`)
  await expect(page.locator('.ng-board')).toBeVisible()
  // Fill one wrong cell first (a blank one), then take it back, to prove marks and undoing do not count.
  const wrong = puzzle.solution.flatMap((row, r) => row.map((on, c) => ({ r, c, on }))).find((x) => !x.on)
  if (wrong) { await page.locator(cell(wrong.r, wrong.c)).click(); await page.locator(cell(wrong.r, wrong.c)).click() }
  for (const [r, row] of puzzle.solution.entries()) for (const [c, on] of row.entries()) if (on) await page.locator(cell(r, c)).click()

  await expect(page.getByText('Picture complete!')).toBeVisible()
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'nonogram', won: true })
  const [progress] = await readTable(page, 'progress')
  expect(progress).toMatchObject({ gameId: 'nonogram', plays: 1 })
})

test('dragging across cells fills a run, and a wrong grid does not finish', async ({ page }) => {
  await page.goto(`/play/nonogram?seed=${SEED}`)
  const a = (await page.locator(cell(0, 0)).boundingBox())!
  const b = (await page.locator(cell(0, 2)).boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 })
  await page.mouse.up()
  for (const c of [0, 1, 2]) await expect(page.locator(cell(0, c))).toHaveAttribute('aria-label', /filled/)
  await expectRows(page, 'history', 0)
})
