import { expect, test, type Page } from '@playwright/test'
import { createRandom } from '../src/lib/rng'
import { newGame, scoreFor } from '../src/games/sudoku/rules'
import { expectRows, readTable } from './helpers'

// The seeded puzzle is computed with the pure rules, then solved through the real UI.

const SEED = 'e2e-sudoku'
const T0 = new Date('2026-10-28T10:00:00Z')
const model = () => newGame(createRandom(SEED), 'medium')
const cell = (page: Page, i: number) => page.locator(`.sdk-cell[data-i="${i}"]`)

async function open(page: Page) {
  await page.clock.install({ time: T0 })
  await page.goto(`/play/sudoku-master?seed=${SEED}`)
  await expect(page.locator('.sdk-grid')).toBeVisible()
  await page.clock.setFixedTime(T0) // time is frozen, so the saved score is exact
}

test('solving the seeded puzzle through the UI (with one mistake and 90 seconds) saves the right score', async ({ page }) => {
  const m = model()
  await open(page)
  const empties = m.puzzle.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0)

  // One wrong digit first.
  await cell(page, empties[0]).click()
  await page.keyboard.press(String(m.solution[empties[0]] === 1 ? 2 : 1))
  await expect(page.getByLabel('Mistakes 1')).toBeVisible()

  await page.clock.setFixedTime(new Date(T0.getTime() + 90_000))
  for (const i of empties) {
    await cell(page, i).click()
    await page.keyboard.press(String(m.solution[i]))
  }
  await expect(page.getByRole('heading', { name: 'Solved!' })).toBeVisible()
  await expectRows(page, 'history', 1)
  expect((await readTable(page, 'history'))[0]).toMatchObject({
    gameId: 'sudoku-master',
    won: true,
    score: scoreFor({ ...m, mistakes: 1 }, 90),
  })

  await page.getByRole('button', { name: 'Play again' }).click()
  await expect(page.locator('.sdk-cell[data-given]')).not.toHaveCount(0)
  await expectRows(page, 'history', 1)
})

test('notes, erase and arrow keys', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'keyboard input')
  const m = model()
  await open(page)
  const empty = m.puzzle.findIndex((v) => v === 0)
  await cell(page, empty).click()
  await page.keyboard.press('n')
  await page.keyboard.press('2')
  await page.keyboard.press('5')
  await expect(cell(page, empty)).toHaveAttribute('aria-label', /notes 2 5/)
  await expect(cell(page, empty)).not.toHaveAttribute('data-v', /.*/)
  await page.keyboard.press('n')
  await page.keyboard.press(String(m.solution[empty]))
  await expect(cell(page, empty)).toHaveAttribute('data-v', String(m.solution[empty]))
  await page.keyboard.press('Backspace')
  await expect(cell(page, empty)).not.toHaveAttribute('data-v', /.*/)

  await cell(page, 0).click()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  await expect(cell(page, 10)).toHaveAttribute('data-selected', 'true')
  await expectRows(page, 'history', 0)
})

test('the number pad works by tap or click', async ({ page }) => {
  const m = model()
  await open(page)
  const empty = m.puzzle.findIndex((v) => v === 0)
  await cell(page, empty).click()
  await page.getByRole('button', { name: `Enter ${m.solution[empty]}` }).click()
  await expect(cell(page, empty)).toHaveAttribute('data-v', String(m.solution[empty]))
  await page.getByRole('button', { name: 'Erase' }).click()
  await expect(cell(page, empty)).not.toHaveAttribute('data-v', /.*/)
})

test('the same seed deals the same puzzle, and the difficulty changes the number of givens', async ({ page }) => {
  const givens = () => page.locator('.sdk-cell').evaluateAll((cells) => cells.map((c) => c.getAttribute('data-v') ?? '.').join(''))
  const load = async () => {
    await page.goto(`/play/sudoku-master?seed=${SEED}`)
    await expect(page.locator('.sdk-grid')).toBeVisible()
    return givens()
  }
  const a = await load()
  expect(await load()).toBe(a)
  expect(a.split('').filter((c) => c !== '.')).toHaveLength(model().puzzle.filter(Boolean).length)

  await page.getByLabel('Difficulty').selectOption('easy')
  await expect(page.locator('.sdk-cell[data-given]')).not.toHaveCount(model().puzzle.filter(Boolean).length)
  await expectRows(page, 'history', 0)
})
