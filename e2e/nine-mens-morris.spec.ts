import { expect, test, type Browser, type Page } from '@playwright/test'
import { createRandom } from '../src/lib/rng'
import { aiPly, apply, isOver, legalPlies, newGame, type Ply } from '../src/games/morris/rules'
import { expectRows, readTable } from './helpers'

const SEED = 'e2e-nm'
const THINK = 550
const pt = (p: Page, i: number) => p.locator(`[data-pt="${i}"]`)
const status = (p: Page) => p.locator('.c4-status')
const cellsOf = (p: Page) =>
  p.locator('[data-pt]').evaluateAll((els) => els.map((el) => Number((el as HTMLElement).dataset.p ?? 0)))

async function click(page: Page, ply: Ply) {
  if (ply.type === 'place') await pt(page, ply.to).click()
  else if (ply.type === 'remove') await pt(page, ply.at).click()
  else {
    await pt(page, ply.from).click()
    await expect(pt(page, ply.from)).toHaveAttribute('data-sel', 'true')
    await expect(pt(page, ply.to)).toHaveAttribute('data-target', 'true')
    await pt(page, ply.to).click()
  }
}

test('plays a whole game against the computer with real clicks, in step with the model, and saves it once', async ({ page }) => {
  test.setTimeout(240_000)
  await page.clock.install({ time: new Date('2026-11-15T10:00:00Z') })
  await page.goto(`/play/nine-mens-morris?seed=${SEED}`)
  await expect(page.locator('.nm-board')).toBeVisible()
  await page.clock.pauseAt(new Date('2026-11-15T10:00:30Z'))
  const ai = createRandom(SEED)
  let model = newGame()
  for (let guard = 0; !isOver(model) && guard < 600; guard++) {
    if (model.turn === 1) {
      const ply = legalPlies(model)[0]
      await click(page, ply)
      model = apply(model, ply)
    } else {
      const ply = aiPly(model, ai, 'normal')!
      await page.clock.runFor(THINK)
      model = apply(model, ply)
    }
    expect(await cellsOf(page)).toEqual(model.cells)
  }
  expect(isOver(model)).toBe(true)
  const heading = model.winner === 1 ? 'You win!' : model.winner === 2 ? 'Computer wins' : 'Draw'
  await expect(page.locator('.game-over').getByRole('heading', { name: heading })).toBeVisible()
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'nine-mens-morris', won: model.winner === 1 })
  await page.clock.runFor(5000)
  await expectRows(page, 'history', 1)
})

test('the keyboard can place a man', async ({ page }) => {
  await page.goto('/play/nine-mens-morris')
  await pt(page, 4).focus()
  await page.keyboard.press('Enter')
  await expect(pt(page, 4)).toHaveAttribute('data-p', '1')
})

async function twoPlayers(browser: Browser, baseURL: string, mobile: boolean) {
  const opts = mobile ? { baseURL, viewport: { width: 393, height: 851 }, hasTouch: true } : { baseURL }
  const a = await (await browser.newContext(opts)).newPage()
  const b = await (await browser.newContext(opts)).newPage()
  await a.goto('/online')
  await a.getByLabel('Game').selectOption('nine-mens-morris')
  await a.getByRole('button', { name: 'Create a room' }).click()
  await expect(a).toHaveURL(/\/room\/[A-Z2-9]{6}\?g=nine-mens-morris$/)
  const code = a.url().split('/').pop()!.split('?')[0]
  await b.goto(`/room/${code}?g=nine-mens-morris`)
  return { a, b }
}

test('two players place in turn, a mill lets the first remove a man, and a reload keeps the game', async ({ browser, baseURL, isMobile }) => {
  const { a, b } = await twoPlayers(browser, baseURL!, !!isMobile)
  await expect(status(a)).toHaveText('Your move')
  await expect(status(b)).toHaveText("Friend's move")

  const turn = async (p: Page, q: Page, i: number) => {
    await pt(p, i).click()
    await expect(pt(q, i)).toHaveAttribute('data-p', p === a ? '1' : '2')
  }
  await turn(a, b, 0)
  // Not your turn: b can place, a clicking again does nothing.
  await turn(b, a, 8)
  await turn(a, b, 1)
  await turn(b, a, 9)
  await pt(a, 2).click()
  await expect(pt(b, 2)).toHaveAttribute('data-p', '1')
  // The mill: a must remove, the opponent's men are highlighted, its own are not.
  await expect(pt(a, 8)).toHaveAttribute('data-remove', 'true')
  await expect(pt(a, 0)).not.toHaveAttribute('data-remove', 'true')
  await expect(pt(b, 8)).not.toHaveAttribute('data-remove', 'true')
  await pt(a, 8).click()
  await expect(pt(b, 8)).not.toHaveAttribute('data-p', /.*/)
  await expect(status(b)).toHaveText('Your move')

  await b.reload()
  await expect(status(b)).toHaveText('Your move')
  expect(await cellsOf(b)).toEqual(await cellsOf(a))
})
