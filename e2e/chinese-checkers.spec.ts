import { expect, test, type Page } from '@playwright/test'
import { createRandom } from '../src/lib/rng'
import { aiMove, isOver, move, newGame } from '../src/games/chinese/rules'
import { expectRows, readTable } from './helpers'

const SEED = 'e2e-cc'
const THINK = 350
const hole = (p: Page, i: number) => p.locator(`[data-pt="${i}"]`)
const cellsOf = (p: Page) => p.locator('[data-pt]').evaluateAll((els) => els.map((el) => Number((el as HTMLElement).dataset.p ?? 0)))

test('plays a whole game against the computer with real clicks, in step with the model, and saves it once', async ({ page }) => {
  test.setTimeout(420_000)
  await page.clock.install({ time: new Date('2026-11-15T10:00:00Z') })
  await page.goto(`/play/chinese-checkers?seed=${SEED}`)
  await expect(page.locator('.cc-board')).toBeVisible()
  await page.clock.pauseAt(new Date('2026-11-15T10:00:30Z'))
  const ai = createRandom(`${SEED}:0`)
  const mine = createRandom('e2e-cc-human')
  let model = newGame(2)
  for (let guard = 0; !isOver(model) && guard < 600; guard++) {
    if (model.turn === 1) {
      const m = aiMove(model, mine, 'normal')!
      await hole(page, m.from).click()
      await expect(hole(page, m.from)).toHaveAttribute('data-sel', 'true')
      await expect(hole(page, m.to)).toHaveAttribute('data-target', 'true')
      await hole(page, m.to).click()
      model = move(model, m.from, m.to)
    } else {
      const m = aiMove(model, ai, 'normal')!
      await page.clock.runFor(THINK)
      model = move(model, m.from, m.to)
    }
    if (guard % 10 === 0 || isOver(model)) expect(await cellsOf(page)).toEqual(model.cells)
  }
  expect(isOver(model)).toBe(true)
  const heading = model.winner === 1 ? 'You win!' : 'blue wins'
  await expect(page.locator('.game-over').getByRole('heading', { name: heading })).toBeVisible()
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'chinese-checkers', won: model.winner === 1 })
  await page.clock.runFor(5000)
  await expectRows(page, 'history', 1)
})

test('the keyboard can pick a man and move it, and Escape drops the pick', async ({ page }) => {
  await page.goto('/play/chinese-checkers')
  const m = aiMove(newGame(2), createRandom('k'), 'normal')!
  await hole(page, m.from).focus()
  await page.keyboard.press('Enter')
  await expect(hole(page, m.from)).toHaveAttribute('data-sel', 'true')
  await page.keyboard.press('Escape')
  await expect(hole(page, m.from)).not.toHaveAttribute('data-sel', 'true')
  await hole(page, m.from).focus()
  await page.keyboard.press('Enter')
  await hole(page, m.to).focus()
  await page.keyboard.press('Enter')
  await expect(hole(page, m.to)).toHaveAttribute('data-p', '1')
})

test('six players deal sixty men', async ({ page }) => {
  await page.goto('/play/chinese-checkers')
  await page.getByLabel('Players').selectOption('6')
  expect((await cellsOf(page)).filter(Boolean)).toHaveLength(60)
})
