import { expect, test, type Page } from '@playwright/test'
import { createRandom } from '../src/lib/rng'
import { aiMove, drop, isOver, newGame, scoreFor } from '../src/games/connect4/rules'
import { expectRows, readTable } from './helpers'

// A pure-rules model plays the same seeded game; the page must agree on every move and the saved result.

const SEED = 'e2e-c4'
const THINK = 450
const col = (page: Page, c: number) => page.locator(`[data-col="${c}"]`)
const cellsOf = (page: Page) =>
  page.locator('.c4-cell').evaluateAll((cells) => cells.map((c) => Number(c.getAttribute('data-p'))))

async function open(page: Page) {
  await page.clock.install({ time: new Date('2026-10-28T10:00:00Z') })
  await page.goto(`/play/connect-four?seed=${SEED}`)
  await expect(page.locator('.c4-board')).toBeVisible()
  await page.clock.pauseAt(new Date('2026-10-28T10:00:30Z'))
}

test('plays a whole game against the computer and saves the result once', async ({ page }) => {
  await open(page)
  const ai = createRandom(SEED)
  const human = createRandom('e2e-human')
  let model = newGame()
  while (!isOver(model)) {
    const c = aiMove(model, human, 2) // a modest human
    model = drop(model, c)
    await col(page, c).click()
    if (!isOver(model)) {
      model = drop(model, aiMove(model, ai))
      await page.clock.runFor(THINK)
    }
    expect(await cellsOf(page)).toEqual(model.cells)
  }

  const heading = model.winner === 1 ? 'You win!' : model.winner === 2 ? 'Computer wins' : 'Draw'
  await expect(page.locator('.game-over').getByRole('heading', { name: heading })).toBeVisible()
  if (model.line) await expect(page.locator('.c4-cell[data-win="true"]')).toHaveCount(4)
  await expectRows(page, 'history', 1)
  expect((await readTable(page, 'history'))[0]).toMatchObject({
    gameId: 'connect-four',
    score: scoreFor(model),
    won: model.winner === 1,
  })

  await page.clock.runFor(10_000)
  await expectRows(page, 'history', 1)
  await page.getByRole('button', { name: 'Play again' }).click()
  await expect(page.getByText('Your move')).toBeVisible()
  expect((await cellsOf(page)).every((p) => p === 0)).toBe(true)
  await expectRows(page, 'history', 1)
})

test('columns are locked while the computer thinks, and keys 1-7 play', async ({ page }) => {
  await open(page)
  await page.keyboard.press('4')
  await expect(page.getByText('Computer is thinking…')).toBeVisible()
  await expect(col(page, 0)).toBeDisabled()
  await page.keyboard.press('1') // ignored mid-think
  expect((await cellsOf(page)).filter((p) => p === 1)).toHaveLength(1)

  const model = drop(newGame(), 3)
  const reply = drop(model, aiMove(model, createRandom(SEED)))
  await page.clock.runFor(THINK)
  await expect(page.getByText('Your move')).toBeVisible()
  expect(await cellsOf(page)).toEqual(reply.cells)
  await expectRows(page, 'history', 0)
})

test('repeated drops in one column stay in step with the model', async ({ page }) => {
  await open(page)
  const ai = createRandom(SEED)
  let model = newGame()
  for (let i = 0; i < 3; i++) {
    // human always column 6 until it fills (the computer replies elsewhere or stacks)
    if (isOver(model)) break
    model = drop(model, 6)
    await col(page, 6).click()
    model = drop(model, aiMove(model, ai))
    await page.clock.runFor(THINK)
  }
  expect(await cellsOf(page)).toEqual(model.cells)
})
