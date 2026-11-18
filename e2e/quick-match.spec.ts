import { expect, test, type Browser, type Page } from '@playwright/test'
import { overflowsHorizontally } from './helpers'

// Slice M3: quick match through the lobby, with two real browser contexts against the real Worker.
// The e2e server shortens the server-side wait to 4 seconds (MATCH_WAIT_MS in playwright.config.ts).

const player = async (browser: Browser, baseURL: string, mobile: boolean) => {
  const opts = mobile ? { baseURL, viewport: { width: 393, height: 851 }, hasTouch: true } : { baseURL }
  return (await browser.newContext(opts)).newPage()
}
const col = (p: Page, n: number) => p.getByRole('button', { name: `Drop in column ${n}` })
const find = (p: Page) => p.getByRole('button', { name: 'Find a match' })

test('two players press Find a match, are paired into the same room, and play a move', async ({ browser, baseURL, isMobile }) => {
  const a = await player(browser, baseURL!, !!isMobile)
  const b = await player(browser, baseURL!, !!isMobile)
  await a.goto('/online')
  await b.goto('/online')
  await expect(a.getByText('No one is waiting for Connect Four right now.')).toBeVisible()

  await find(a).click()
  await expect(a.getByText(/Looking for an opponent in Connect Four/)).toBeVisible()
  // The second visitor sees the real count (the page refreshes it every 10 seconds, so reload to see it now).
  expect(await overflowsHorizontally(a)).toBe(false)

  await find(b).click()
  await expect(a.getByText('Opponent found!')).toBeVisible()
  await expect(b.getByText('Opponent found!')).toBeVisible()
  await expect(a).toHaveURL(/\/room\/[A-Z2-9]{6}\?g=connect-four&q=1$/)
  await expect(b).toHaveURL(/\/room\/[A-Z2-9]{6}\?g=connect-four&q=1$/)
  expect(a.url()).toBe(b.url())

  // Both are seated and the first player's move reaches the other.
  const first = (await a.getByText('Your move').isVisible()) ? a : b
  const second = first === a ? b : a
  await expect(first.getByText('Your move')).toBeVisible()
  await expect(second.getByText("Friend's move")).toBeVisible()
  await col(first, 4).click()
  await expect(second.locator('.c4-cell:not([data-p="0"])')).toHaveCount(1)
})

test('Cancel takes a waiting player out of the queue', async ({ browser, baseURL, isMobile }) => {
  const a = await player(browser, baseURL!, !!isMobile)
  await a.goto('/online')
  await a.getByLabel('Game').selectOption('checkers')
  await find(a).click()
  await expect(a.getByText(/Looking for an opponent in Checkers/)).toBeVisible()
  await a.getByRole('button', { name: 'Cancel' }).click()
  await expect(find(a)).toBeVisible()
  await expect(a.getByText('No one is waiting for Checkers right now.')).toBeVisible()
})

test('after 20 seconds the player is offered the computer, an invite, or to keep waiting; it never claims the computer is a person', async ({ browser, baseURL, isMobile }) => {
  const a = await player(browser, baseURL!, !!isMobile)
  await a.clock.install()
  await a.goto('/online')
  await a.getByLabel('Game').selectOption('tic-tac-toe')
  await find(a).click()
  await expect(a.getByText(/Looking for an opponent in Tic-Tac-Toe/)).toBeVisible()
  await a.clock.runFor(20_000)
  const offer = a.getByRole('group', { name: 'Nobody yet' })
  await expect(offer).toBeVisible()
  await expect(offer.getByText(/\((computer)\)/).first()).toBeVisible()
  await expect(offer.getByRole('link', { name: /\(computer\) now/ })).toHaveAttribute('href', /^\/play\/tic-tac-toe\?vs=(Ada|Zara|Mei|Sophia|Ananya)$/)
  await expect(offer.getByRole('button', { name: 'Invite a friend' })).toBeVisible()
  await offer.getByRole('button', { name: 'Keep waiting for a person' }).click()
  await expect(offer).toHaveCount(0)
  await a.clock.runFor(10_000)
  await expect(a).toHaveURL(/\/online/) // still waiting for a person
})

test('if nobody joins, a named computer player takes the seat, labelled as a computer', async ({ browser, baseURL, isMobile }) => {
  const a = await player(browser, baseURL!, !!isMobile)
  await a.clock.install()
  await a.goto('/online')
  await a.getByLabel('Game').selectOption('checkers')
  await find(a).click()
  await expect(a.getByText(/Looking for an opponent/)).toBeVisible()
  await a.clock.runFor(24_000)
  await expect(a).toHaveURL(/\/play\/checkers\?vs=(Ada|Zara|Mei|Sophia|Ananya)$/)
  await expect(a.getByText(/You are playing \w+ \(computer\)\. No one else was waiting\./)).toBeVisible()
})

test('a crafted ?vs= value shows no banner', async ({ page }) => {
  await page.goto('/play/checkers?vs=%3Cb%3Eevil')
  await expect(page.getByText(/You are playing/)).toHaveCount(0)
})

test('a player nobody pairs with is told so, and can try again', async ({ browser, baseURL, isMobile }) => {
  const a = await player(browser, baseURL!, !!isMobile)
  await a.goto('/online')
  await a.getByLabel('Game').selectOption('battleship')
  await find(a).click()
  await expect(a.getByText('No one joined in time. Nothing was lost.')).toBeVisible({ timeout: 12_000 })
  await expect(a.getByRole('button', { name: 'Try again' })).toBeVisible()
  await expect(a.getByRole('link', { name: /\(computer\) now/ })).toHaveAttribute('href', /^\/play\/battleship\?vs=/)
})

test('Invite a friend from the offer opens a private room', async ({ browser, baseURL, isMobile }) => {
  const a = await player(browser, baseURL!, !!isMobile)
  await a.clock.install()
  await a.goto('/online')
  await find(a).click()
  await expect(a.getByText(/Looking for an opponent/)).toBeVisible()
  await a.clock.runFor(20_000)
  await a.getByRole('button', { name: 'Invite a friend' }).click()
  await expect(a).toHaveURL(/\/room\/[A-Z2-9]{6}\?g=connect-four$/)
})

test('World Trip has no quick match, and the page says why', async ({ browser, baseURL, isMobile }) => {
  const a = await player(browser, baseURL!, !!isMobile)
  await a.goto('/online')
  await a.getByLabel('Game').selectOption('world-trip')
  await expect(find(a)).toHaveCount(0)
  await expect(a.getByText(/World Trip takes two to six players/)).toBeVisible()
})

test('if the matched opponent never arrives, the room offers to find another one', async ({ browser, baseURL, isMobile }) => {
  const a = await player(browser, baseURL!, !!isMobile)
  const b = await player(browser, baseURL!, !!isMobile)
  await a.clock.install()
  await a.goto('/online')
  await b.goto('/online')
  await find(a).click()
  await expect(a.getByText(/Looking for an opponent/)).toBeVisible()
  await find(b).click()
  await expect(b.getByText('Opponent found!')).toBeVisible()
  await b.close() // closes before reaching the room
  await a.clock.runFor(2000) // "Opponent found" pause on a's fake clock
  await expect(a).toHaveURL(/\/room\//)
  await expect(a.getByText('Waiting for your friend…').first()).toBeVisible()
  await a.clock.runFor(16_000)
  const again = a.getByRole('link', { name: 'Find another opponent' })
  await expect(again).toBeVisible()
  await again.click()
  await expect(a).toHaveURL(/\/online\?g=connect-four&find=1$/)
  await expect(a.getByRole("region", { name: "Quick match" })).toBeVisible()
})
