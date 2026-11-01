import { expect, test, type Browser, type Page } from '@playwright/test'
import { ADJECTIVES, NOUNS, nickName } from '../src/lib/leaderboard'
import { overflowsHorizontally } from './helpers'

const cell = (p: Page, i: number) => p.locator(`[data-cell="${i}"]`)
const status = (p: Page) => p.locator('.c4-status')
const savedNick = (p: Page) => p.evaluate(() => localStorage.getItem('govibearcadia.nick'))

test('opting in and out: a word-list nickname is offered, saved on this device, and "leave" deletes it', async ({ page }) => {
  await page.goto('/leaderboard')
  await expect(page.getByRole('heading', { name: 'Leaderboards' })).toBeVisible()
  expect(await savedNick(page)).toBeNull()
  const first = await page.locator('.lb-suggest strong').innerText()
  expect(first).toMatch(new RegExp(`^(${ADJECTIVES.join('|')}) (${NOUNS.join('|')}) \\d{1,2}$`))
  await page.getByRole('button', { name: 'Another one' }).click()
  await page.getByRole('button', { name: 'Join the leaderboards' }).click()
  const stored = JSON.parse((await savedNick(page))!)
  await expect(page.getByRole('heading', { name: `You are ${nickName(stored)}` })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: `You are ${nickName(stored)}` })).toBeVisible()

  const deleted = page.waitForRequest((r) => r.url().endsWith('/api/leaderboard/me') && r.method() === 'DELETE')
  await page.getByRole('button', { name: 'Leave the leaderboards' }).click()
  const req = await deleted
  expect(req.headers()['x-player-token']).toMatch(/^[A-Za-z0-9_-]{16,64}$/)
  await expect(page.getByRole('heading', { name: 'Join with a nickname' })).toBeVisible()
  expect(await savedNick(page)).toBeNull()
  await expect(page.getByText('were deleted from the server')).toBeVisible()
})

test('if the server cannot be reached the page says so and nothing is deleted locally by mistake', async ({ page }) => {
  await page.route('**/api/leaderboard**', (route) => route.abort())
  await page.goto('/leaderboard')
  await expect(page.getByText('not available right now')).toBeVisible()
  await page.evaluate(() => localStorage.setItem('govibearcadia.nick', JSON.stringify({ a: 0, n: 0, k: 7 })))
  await page.reload()
  await page.getByRole('button', { name: 'Leave the leaderboards' }).click()
  await expect(page.getByText('nothing was deleted')).toBeVisible()
  expect(await savedNick(page)).not.toBeNull()
})

async function twoPlayers(browser: Browser, baseURL: string, mobile: boolean, aNick: object | null) {
  const opts = mobile ? { baseURL, viewport: { width: 393, height: 851 }, hasTouch: true } : { baseURL }
  const a = await (await browser.newContext(opts)).newPage()
  const b = await (await browser.newContext(opts)).newPage()
  if (aNick) await a.addInitScript((n) => localStorage.setItem('govibearcadia.nick', JSON.stringify(n)), aNick)
  await a.goto('/online')
  await a.getByLabel('Game').selectOption('tic-tac-toe')
  await a.getByRole('button', { name: 'Create a room' }).click()
  await expect(a).toHaveURL(/\/room\/[A-Z2-9]{6}\?g=tic-tac-toe$/)
  const code = a.url().split('/').pop()!.split('?')[0]
  await b.goto(`/room/${code}?g=tic-tac-toe`)
  await expect(status(a)).toHaveText('Your move')
  return { a, b }
}

async function aWins(a: Page, b: Page) {
  for (const [p, i] of [[a, 0], [b, 3], [a, 1], [b, 4], [a, 2]] as const) {
    await cell(p, i).click()
    await expect(cell(a, i)).not.toHaveAttribute('data-p', '0')
  }
  await expect(status(a)).toHaveText('You win!')
}

test('an opted-in player who wins an online game appears on the board, marked as them; the loser does not', async ({ browser, baseURL, isMobile }) => {
  const nick = { a: Math.floor(Math.random() * 32), n: Math.floor(Math.random() * 32), k: Math.floor(Math.random() * 100) }
  const { a, b } = await twoPlayers(browser, baseURL!, !!isMobile, nick)
  await aWins(a, b)

  await a.goto('/leaderboard')
  const row = a.locator('.lb-list li[data-me="true"]')
  await expect(row).toContainText(`${nickName(nick)} (you)`)
  await expect(row.locator('strong')).toHaveText('1')
  await a.getByLabel('Game', { exact: true }).selectOption('tic-tac-toe')
  await expect(row).toBeVisible()
  await a.getByRole('button', { name: 'All time' }).click()
  await expect(row).toBeVisible()
  await a.getByLabel('Game', { exact: true }).selectOption('connect-four')
  await expect(a.locator('.lb-list li[data-me="true"]')).toHaveCount(0)

  // The other player never opted in: nothing about them is on the board.
  await b.goto('/leaderboard')
  await expect(b.getByRole('heading', { name: 'Join with a nickname' })).toBeVisible()
  await expect(b.locator('.lb-list li[data-me="true"]')).toHaveCount(0)
})

test('the leaderboard page fits a phone and is linked from the nav, the lobby and the home page', async ({ page, isMobile }) => {
  await page.goto('/leaderboard')
  expect(await overflowsHorizontally(page)).toBe(false)
  await page.goto('/online')
  await page.getByRole('link', { name: 'leaderboards' }).click()
  await expect(page).toHaveURL(/\/leaderboard$/)
  await page.goto('/')
  await page.getByRole('link', { name: 'Leaderboards' }).first().click()
  await expect(page).toHaveURL(/\/leaderboard$/)
  if (!isMobile) {
    await page.goto('/')
    await page.locator('.nav').getByRole('link', { name: 'Leaderboard' }).click()
    await expect(page).toHaveURL(/\/leaderboard$/)
  }
})
