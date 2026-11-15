import { expect, test, type Page } from '@playwright/test'
import { createRandom } from '../src/lib/rng'
import { aiMove, apply, isOver, newGame, pawnMoves } from '../src/games/quoridor/rules'
import { expectRows, readTable } from './helpers'

const SEED = 'e2e-qr'
const THINK = 500
const cell = (p: Page, r: number, c: number) => p.locator(`[data-r="${r}"][data-c="${c}"]`)
const status = (p: Page) => p.locator('.c4-status')
const pawnsOf = (p: Page) =>
  p.locator('.qr-pawn').evaluateAll((els) =>
    els.map((el) => ({ p: Number((el as HTMLElement).dataset.p), r: Number(el.parentElement!.dataset.r), c: Number(el.parentElement!.dataset.c) })).sort((a, b) => a.p - b.p),
  )

test('plays a whole game against the computer with real clicks, in step with the model, and saves it once', async ({ page }) => {
  test.setTimeout(180_000)
  await page.clock.install({ time: new Date('2026-11-15T10:00:00Z') })
  await page.goto(`/play/quoridor?seed=${SEED}`)
  await expect(page.locator('.qr-board')).toBeVisible()
  await page.clock.pauseAt(new Date('2026-11-15T10:00:30Z'))
  const ai = createRandom(`${SEED}:0`)
  let model = newGame()
  for (let guard = 0; !isOver(model) && guard < 400; guard++) {
    if (model.turn === 1) {
      const to = pawnMoves(model, 1).sort((a, b) => a.r - b.r)[0]
      await expect(cell(page, to.r, to.c)).toBeEnabled()
      await cell(page, to.r, to.c).click()
      model = apply(model, { type: 'pawn', to })
    } else {
      const m = aiMove(model, ai, 'normal')!
      await page.clock.runFor(THINK)
      model = apply(model, m)
    }
    const pawns = await pawnsOf(page)
    expect(pawns.map(({ r, c }) => ({ r, c }))).toEqual(model.pawns)
    expect(await page.locator('.qr-wall:not([data-preview])').count()).toBe(model.walls.length)
  }
  expect(isOver(model)).toBe(true)
  const heading = model.winner === 1 ? 'You win!' : 'Computer wins'
  await expect(page.locator('.game-over').getByRole('heading', { name: heading })).toBeVisible()
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'quoridor', won: model.winner === 1 })
  await page.clock.runFor(5000)
  await expectRows(page, 'history', 1)
})

test('the arrow keys move the pawn', async ({ page }) => {
  await page.goto('/play/quoridor')
  await expect(page.locator('.qr-board')).toBeVisible()
  await page.keyboard.press('ArrowUp')
  await expect(cell(page, 7, 4).locator('.qr-pawn')).toHaveAttribute('data-p', '1')
})

test('a wall can be previewed, rotated, placed and counted', async ({ page }) => {
  await page.goto('/play/quoridor')
  await page.getByRole('button', { name: 'Place a wall' }).click()
  await page.locator('[data-anchor="3-3"]').hover()
  await expect(page.locator('[data-preview="ok"]')).toBeVisible()
  await page.keyboard.press('r')
  await expect(page.getByRole('button', { name: 'Rotate wall' })).toContainText('down')
  await page.locator('[data-anchor="3-3"]').click()
  await expect(page.locator('.qr-wall[data-wall="v33"]')).toBeVisible()
  await expect(page.locator('.qr-stats')).toContainText('9')
})

test('two players on one screen alternate turns', async ({ page }) => {
  await page.goto('/play/quoridor')
  await page.getByLabel('Opponent').selectOption('two')
  await expect(status(page)).toContainText("Player 1's move")
  await cell(page, 7, 4).click()
  await expect(status(page)).toContainText("Player 2's move")
  await cell(page, 1, 4).click()
  await expect(status(page)).toContainText("Player 1's move")
})
