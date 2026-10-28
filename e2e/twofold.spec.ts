import { expect, test, type Page } from '@playwright/test'
import { createRandom } from '../src/lib/rng'
import { conflicts, newGame, scoreFor, type Mark } from '../src/games/twofold/rules'
import { expectRows, readTable } from './helpers'

// The seeded puzzle is computed with the pure rules, then solved with real taps.

const SEED = 'e2e-twofold'
const T0 = new Date('2026-10-28T10:00:00Z')
const model = () => newGame(6, createRandom(SEED))
const cell = (page: Page, i: number) => page.locator(`[data-cell="${i}"]`)

async function open(page: Page) {
  await page.clock.install({ time: T0 })
  await page.goto(`/play/twofold?seed=${SEED}`)
  await expect(page.locator('.tf-board')).toBeVisible()
  await page.clock.setFixedTime(T0)
}

test('solving the seeded puzzle with real taps saves the right score', async ({ page }) => {
  const m = model()
  await open(page)
  const free = m.cells.map((v, i) => (v === -1 ? i : -1)).filter((i) => i >= 0)
  await cell(page, free[0]).click()
  await page.clock.setFixedTime(new Date(T0.getTime() + 40_000))
  await cell(page, free[0]).click()
  await cell(page, free[0]).click() // back to empty
  for (const i of free) for (let k = 0; k <= m.puzzle.solution[i]; k++) await cell(page, i).click()
  await expect(page.getByText(/Solved in 40s/)).toBeVisible()
  await expectRows(page, 'history', 1)
  expect((await readTable(page, 'history'))[0]).toMatchObject({ gameId: 'twofold', won: true, score: scoreFor(40) })
})

test('fixed cells do not change, and the same seed deals the same board', async ({ page }) => {
  const m = model()
  await open(page)
  const given = m.cells.findIndex((v) => v !== -1)
  const before = await cell(page, given).textContent()
  await cell(page, given).click({ force: true })
  await expect(cell(page, given)).toHaveText(before!)
  await page.reload()
  await expect(cell(page, given)).toHaveText(before!)
  await expectRows(page, 'history', 0)
})

test('a move that breaks a rule is marked', async ({ page }) => {
  await open(page)
  const m = model()
  const [i, v] = m.cells
    .flatMap((c, k) => (c === -1 ? [[k, 0], [k, 1]] : []))
    .find(([k, sym]) => {
      const next = [...m.cells]
      next[k] = sym as Mark
      return conflicts(6, next).has(k)
    })!
  for (let k = 0; k <= v; k++) await cell(page, i).click()
  await expect(cell(page, i)).toHaveClass(/bad/)
})
