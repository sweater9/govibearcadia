import { expect, test, type Page } from '@playwright/test'
import { apply, newGame, type Move } from '../src/games/shogi/rules'

const sq = (row: number, col: number) => row * 9 + col
const square = (p: Page, i: number) => p.locator(`[data-sq="${i}"]`)
const status = (p: Page) => p.locator('.c4-status')
const cellsOf = (p: Page) =>
  p.locator('[data-sq]').evaluateAll((els) => els.map((el) => {
    const d = (el as HTMLElement).dataset
    return d.k ? Number(d.k) + (d.p === '2' ? 16 : 0) : 0
  }))
const move = (from: number, to: number, promote = false): Move => ({ from, to, drop: 0, promote })

test('you move, the computer answers, and every piece is still on the board', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-15T10:00:00Z') })
  await page.goto('/play/shogi?seed=e2e-sg')
  await expect(page.locator('.sg-board')).toBeVisible()
  await page.clock.pauseAt(new Date('2026-11-15T10:00:30Z'))
  await square(page, sq(6, 2)).click()
  await expect(square(page, sq(6, 2))).toHaveAttribute('data-sel', 'true')
  await expect(square(page, sq(5, 2))).toHaveAttribute('data-target', 'true')
  await square(page, sq(5, 2)).click()
  await expect(status(page)).toHaveText('Computer is thinking…')
  await page.clock.runFor(500)
  await expect(status(page)).toHaveText('Your move')
  const cells = await cellsOf(page)
  expect(cells.filter(Boolean)).toHaveLength(40)
  expect(cells[sq(5, 2)]).toBe(1)
  expect(cells[sq(6, 2)]).toBe(0)
})

test('two players: a bishop trade with promotion, then the captured bishop is dropped back', async ({ page }) => {
  await page.goto('/play/shogi')
  await page.getByLabel('Opponent').selectOption('two')
  let model = newGame()
  const play = async (m: Move, promptChoice?: 'Promote' | "Don't promote") => {
    await square(page, m.from).click()
    await expect(square(page, m.to)).toHaveAttribute('data-target', 'true')
    await square(page, m.to).click()
    if (promptChoice) await page.getByRole('button', { name: promptChoice, exact: true }).click()
    model = apply(model, m)
    expect(await cellsOf(page)).toEqual(model.cells)
  }
  await play(move(sq(6, 2), sq(5, 2)))
  await play(move(sq(2, 6), sq(3, 6)))
  await play(move(sq(7, 1), sq(1, 7), true), 'Promote')
  await expect(status(page)).toHaveText('White to move')
  await play(move(sq(0, 6), sq(1, 7)))
  // Black now holds the captured bishop and drops it on the board.
  // White also holds a captured bishop; only the side to move can use theirs.
  const held = page.getByRole('button', { name: 'bishop in hand, 1' }).and(page.locator(':enabled'))
  await expect(held).toBeVisible()
  await held.click()
  await expect(square(page, sq(4, 4))).toHaveAttribute('data-target', 'true')
  await square(page, sq(4, 4)).click()
  model = apply(model, { from: -1, to: sq(4, 4), drop: 6, promote: false })
  expect(await cellsOf(page)).toEqual(model.cells)
  await expect(page.getByRole('button', { name: /bishop in hand/ })).toHaveCount(1)
})

test('the keyboard can pick a piece and move it, and Escape drops the pick', async ({ page }) => {
  await page.goto('/play/shogi')
  await expect(square(page, sq(6, 2))).toBeVisible()
  await square(page, sq(6, 2)).focus()
  await page.keyboard.press('Enter')
  await expect(square(page, sq(6, 2))).toHaveAttribute('data-sel', 'true')
  await page.keyboard.press('Escape')
  await expect(square(page, sq(6, 2))).not.toHaveAttribute('data-sel', 'true')
  await square(page, sq(6, 2)).focus()
  await page.keyboard.press('Enter')
  await square(page, sq(5, 2)).focus()
  await page.keyboard.press('Enter')
  await expect(square(page, sq(5, 2))).toHaveAttribute('data-p', '1')
})

test('the label button cycles kanji, letters and both', async ({ page }) => {
  await page.goto('/play/shogi')
  await expect(page.locator('.sg-sq[data-k="1"] .sg-kanji').first()).toHaveText('歩')
  await page.getByRole('button', { name: /Piece labels/ }).click()
  await expect(page.locator('.sg-sq[data-k="1"] .sg-eng').first()).toHaveText('P')
  await expect(page.locator('.sg-sq[data-k="1"] .sg-kanji')).toHaveCount(0)
})
