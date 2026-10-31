import { expect, test, type Browser, type Page } from '@playwright/test'
import { createRandom } from '../src/lib/rng'
import { aiStep, isOver, legalSteps, newGame, sq, step } from '../src/games/checkers/rules'
import { expectRows, readTable } from './helpers'

const SEED = 'e2e-ck'
const THINK = 500
const square = (p: Page, i: number) => p.locator(`[data-sq="${i}"]`)
const status = (p: Page) => p.locator('.c4-status')
const cellsOf = (p: Page) =>
  p.locator('[data-sq]').evaluateAll((els) => {
    const out = Array<number>(64).fill(0)
    for (const el of els) {
      const piece = el.querySelector('.ck-piece')
      if (piece) out[Number((el as HTMLElement).dataset.sq)] = Number(piece.getAttribute('data-p')) + (piece.hasAttribute('data-king') ? 2 : 0)
    }
    return out
  })

test('plays a whole game against the computer with real clicks, in step with the model, and saves it once', async ({ page }) => {
  test.setTimeout(180_000)
  await page.clock.install({ time: new Date('2026-10-28T10:00:00Z') })
  await page.goto(`/play/checkers?seed=${SEED}`)
  await expect(page.locator('.ck-board')).toBeVisible()
  await page.clock.pauseAt(new Date('2026-10-28T10:00:30Z'))
  const ai = createRandom(SEED)
  let model = newGame()
  for (let guard = 0; !isOver(model) && guard < 600; guard++) {
    if (model.turn === 1) {
      const m = legalSteps(model)[0]
      await square(page, m.from).click()
      await expect(square(page, m.from)).toHaveAttribute('data-sel', 'true')
      await expect(square(page, m.to)).toHaveAttribute('data-target', 'true')
      await square(page, m.to).click()
      model = step(model, m.from, m.to)
    } else {
      const m = aiStep(model, ai)!
      await page.clock.runFor(THINK)
      model = step(model, m.from, m.to)
    }
    expect(await cellsOf(page)).toEqual(model.cells)
  }
  expect(isOver(model)).toBe(true)
  const heading = model.winner === 1 ? 'You win!' : model.winner === 2 ? 'Computer wins' : 'Draw'
  await expect(page.locator('.game-over').getByRole('heading', { name: heading })).toBeVisible()
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'checkers', won: model.winner === 1 })
  await page.clock.runFor(5000)
  await expectRows(page, 'history', 1)
})

test('a piece that cannot move is not selected, and Escape drops the pick', async ({ page }) => {
  await page.goto('/play/checkers')
  await square(page, sq(7, 0)).click()
  await expect(square(page, sq(7, 0))).not.toHaveAttribute('data-sel', 'true')
  await square(page, sq(5, 2)).click()
  await expect(square(page, sq(5, 2))).toHaveAttribute('data-sel', 'true')
  await page.keyboard.press('Escape')
  await expect(square(page, sq(5, 2))).not.toHaveAttribute('data-sel', 'true')
})

test('the keyboard can pick and move a piece', async ({ page }) => {
  await page.goto('/play/checkers')
  await square(page, sq(5, 0)).focus()
  await page.keyboard.press('Enter')
  await expect(square(page, sq(5, 0))).toHaveAttribute('data-sel', 'true')
  await square(page, sq(4, 1)).focus()
  await page.keyboard.press('Enter')
  await expect(square(page, sq(4, 1)).locator('.ck-piece')).toHaveAttribute('data-p', '1')
})

async function twoPlayers(browser: Browser, baseURL: string, mobile: boolean) {
  const opts = mobile ? { baseURL, viewport: { width: 393, height: 851 }, hasTouch: true } : { baseURL }
  const a = await (await browser.newContext(opts)).newPage()
  const b = await (await browser.newContext(opts)).newPage()
  await a.goto('/online')
  await a.getByLabel('Game').selectOption('checkers')
  await a.getByRole('button', { name: 'Create a room' }).click()
  await expect(a).toHaveURL(/\/room\/[A-Z2-9]{6}\?g=checkers$/)
  const code = a.url().split('/').pop()!.split('?')[0]
  await b.goto(`/room/${code}?g=checkers`)
  return { a, b }
}

test('two players move in turn, the second player sees a flipped board, and a reload keeps the game', async ({ browser, baseURL, isMobile }) => {
  const { a, b } = await twoPlayers(browser, baseURL!, !!isMobile)
  await expect(status(a)).toHaveText('Your move')
  await expect(status(b)).toHaveText("Friend's move")
  // The second player's own pieces are at the bottom: the first square on screen is square 63.
  expect(await a.locator('[data-sq]').first().getAttribute('data-sq')).toBe('1')
  expect(await b.locator('[data-sq]').first().getAttribute('data-sq')).toBe('62')

  await square(a, sq(5, 0)).click()
  await square(a, sq(4, 1)).click()
  await expect(square(b, sq(4, 1)).locator('.ck-piece')).toHaveAttribute('data-p', '1')
  await expect(status(b)).toHaveText('Your move')

  // b picks one of its own pieces; a's pieces are not selectable by b.
  await square(b, sq(3, 0)).click()
  await expect(square(b, sq(3, 0))).not.toHaveAttribute('data-sel', 'true')
  await square(b, sq(2, 1)).click()
  await expect(square(b, sq(2, 1))).toHaveAttribute('data-sel', 'true')
  await expect(square(b, sq(3, 0))).toHaveAttribute('data-target', 'true')
  await square(b, sq(3, 0)).click()
  await expect(square(a, sq(3, 0)).locator('.ck-piece')).toHaveAttribute('data-p', '2')
  await expect(status(a)).toHaveText('Your move')

  await b.reload()
  await expect(status(b)).toHaveText("Friend's move")
  expect(await cellsOf(b)).toEqual(await cellsOf(a))
})
