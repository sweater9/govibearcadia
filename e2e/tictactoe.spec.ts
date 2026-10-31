import { expect, test, type Browser, type Page } from '@playwright/test'
import { createRandom } from '../src/lib/rng'
import { aiMove, isOver, newGame, play } from '../src/games/tictactoe/rules'
import { expectRows, readTable } from './helpers'

const SEED = 'e2e-ttt'
const THINK = 400
const cell = (p: Page, i: number) => p.locator(`[data-cell="${i}"]`)
const marks = (p: Page) => p.locator('.ttt-cell').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-p'))))
const status = (p: Page) => p.locator('.c4-status')

test('plays a whole game against the computer with real clicks and saves the result once', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-28T10:00:00Z') })
  await page.goto(`/play/tic-tac-toe?seed=${SEED}`)
  await expect(page.locator('.ttt-board')).toBeVisible()
  await page.clock.pauseAt(new Date('2026-10-28T10:00:30Z'))
  const ai = createRandom(SEED)
  let model = newGame()
  while (!isOver(model)) {
    const free = model.cells.flatMap((c, i) => (c === 0 ? [i] : []))[0]
    model = play(model, free)
    await cell(page, free).click()
    if (!isOver(model)) {
      model = play(model, aiMove(model, ai))
      await page.clock.runFor(THINK)
    }
    expect(await marks(page)).toEqual(model.cells)
  }
  const heading = model.winner === 1 ? 'You win!' : model.winner === 2 ? 'Computer wins' : 'Draw'
  await expect(page.locator('.game-over').getByRole('heading', { name: heading })).toBeVisible()
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'tic-tac-toe', won: model.winner === 1 })
  await page.clock.runFor(5000)
  await expectRows(page, 'history', 1)
})

test('number keys play, and the board is locked while the computer thinks', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-28T10:00:00Z') })
  await page.goto(`/play/tic-tac-toe?seed=${SEED}`)
  await expect(page.locator('.ttt-board')).toBeVisible() // the game loads lazily; keys only work once it is mounted
  await page.clock.pauseAt(new Date('2026-10-28T10:00:30Z'))
  await page.keyboard.press('5')
  await expect(status(page)).toHaveText('Computer is thinking…')
  await expect(cell(page, 0)).toBeDisabled()
  await page.keyboard.press('1')
  expect((await marks(page)).filter((p) => p === 1)).toHaveLength(1)
  await page.clock.runFor(THINK)
  await expect(status(page)).toHaveText('Your move')
})

async function twoPlayers(browser: Browser, baseURL: string, mobile: boolean) {
  const opts = mobile ? { baseURL, viewport: { width: 393, height: 851 }, hasTouch: true } : { baseURL }
  const a = await (await browser.newContext(opts)).newPage()
  const b = await (await browser.newContext(opts)).newPage()
  await a.goto('/online')
  await a.getByLabel('Game').selectOption('tic-tac-toe')
  await a.getByRole('button', { name: 'Create a room' }).click()
  await expect(a).toHaveURL(/\/room\/[A-Z2-9]{6}\?g=tic-tac-toe$/)
  const code = a.url().split('/').pop()!.split('?')[0]
  await b.goto(`/room/${code}?g=tic-tac-toe`)
  return { a, b }
}

test('two players finish an online game, each saves it once, and the rematch swaps who starts', async ({ browser, baseURL, isMobile }) => {
  const { a, b } = await twoPlayers(browser, baseURL!, !!isMobile)
  await expect(status(a)).toHaveText('Your move')
  await expect(status(b)).toHaveText("Friend's move")
  await expect(cell(b, 0)).toBeDisabled()

  for (const [p, i] of [[a, 0], [b, 3], [a, 1], [b, 4], [a, 2]] as const) {
    await expect(cell(p, i)).toBeEnabled()
    await cell(p, i).click()
    await expect(cell(a, i)).toHaveAttribute('data-p', p === a ? '1' : '2')
    await expect(cell(b, i)).toHaveAttribute('data-p', p === a ? '1' : '2')
  }
  await expect(status(a)).toHaveText('You win!')
  await expect(status(b)).toHaveText('You lose')
  await expect(a.locator('.ttt-cell[data-win="true"]')).toHaveCount(3)
  await expect(a.getByLabel('Score')).toHaveText('1 – 0')
  await expect(b.getByLabel('Score')).toHaveText('0 – 1')
  await expectRows(a, 'history', 1)
  await expectRows(b, 'history', 1)

  await a.getByRole('button', { name: 'Rematch' }).click()
  await expect(a.getByRole('button', { name: 'Waiting for your friend…' })).toBeVisible()
  await b.getByRole('button', { name: 'Accept rematch' }).click()
  await expect(status(b)).toHaveText('Your move')
  await expect(status(a)).toHaveText("Friend's move")
  await a.reload()
  await expect(status(a)).toHaveText("Friend's move")
  await expectRows(a, 'history', 1)
})

test('a move on a taken square or out of turn is ignored by the server', async ({ browser, baseURL, isMobile }) => {
  const { a, b } = await twoPlayers(browser, baseURL!, !!isMobile)
  await cell(a, 4).click()
  await expect(cell(b, 4)).toHaveAttribute('data-p', '1')
  await expect(cell(b, 4)).toBeDisabled()
  await cell(b, 0).click()
  await expect(cell(a, 0)).toHaveAttribute('data-p', '2')
  expect(await marks(a)).toEqual(await marks(b))
})
