import { expect, test, type Page } from '@playwright/test'
import { createRandom } from '../src/lib/rng'
import { newGame, solve } from '../src/games/colorsort/rules'
import { expectRows, readTable } from './helpers'

// The seeded deal is computed with the pure rules, solved, and the solution is played through the real UI.

const SEED = 'e2e-color-sort'
const tube = (page: Page, i: number) => page.locator(`.csort-tube[data-i="${i}"]`)
const moves = (page: Page) => page.getByText('Moves', { exact: true }).locator('xpath=following-sibling::strong')

test('solving the seeded deal through the UI saves one winning run', async ({ page }) => {
  const solution = solve(newGame(createRandom(SEED)).tubes, 200000)!
  await page.goto(`/play/color-sort?seed=${SEED}`)
  await expect(tube(page, 0)).toBeVisible()

  for (const [from, to] of solution) {
    await tube(page, from).click()
    await tube(page, to).click()
  }
  await expect(page.getByRole('heading', { name: 'Sorted!' })).toBeVisible()
  await expect(moves(page)).toHaveText(String(solution.length))
  await expectRows(page, 'history', 1)
  expect((await readTable(page, 'history'))[0]).toMatchObject({ gameId: 'color-sort', won: true })

  await page.getByRole('button', { name: 'Play again' }).click()
  await expect(moves(page)).toHaveText('0')
  await expectRows(page, 'history', 1) // a fresh game records nothing by itself
})

test('selecting highlights a tube, an illegal pour keeps the count, undo and keys work', async ({ page }) => {
  const solution = solve(newGame(createRandom(SEED)).tubes, 200000)!
  const [from, to] = solution[0]
  await page.goto(`/play/color-sort?seed=${SEED}`)

  await tube(page, from).click()
  await expect(tube(page, from)).toHaveAttribute('data-selected', 'true')
  await tube(page, to).click()
  await expect(moves(page)).toHaveText('1')

  await page.getByRole('button', { name: /Undo/ }).click()
  await expect(moves(page)).toHaveText('0')

  await page.keyboard.press(String(from + 1))
  await page.keyboard.press(String(to + 1))
  await expect(moves(page)).toHaveText('1')
  await page.keyboard.press('u')
  await expect(moves(page)).toHaveText('0')
  await expectRows(page, 'history', 0)
})

test('the same seed deals the same tubes', async ({ page }) => {
  const dealt = async () => {
    await page.goto(`/play/color-sort?seed=${SEED}`)
    await expect(tube(page, 0)).toBeVisible()
    return page.locator('.csort-ball').evaluateAll((balls) => balls.map((b) => b.getAttribute('data-color')).join(''))
  }
  const a = await dealt()
  expect(await dealt()).toBe(a)
  expect(a.length).toBe(24)
})
