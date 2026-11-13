import { expect, test, type Browser, type Page } from '@playwright/test'
import { overflowsHorizontally } from './helpers'

// Up to six real browsers join one World Trip room through the lobby against the real Worker.

const moves = (p: Page) => [
  p.getByRole('button', { name: /^Roll (dice|for doubles)$/ }), p.getByRole('button', { name: /^Move \d+ spaces$/ }),
  p.getByRole('button', { name: 'Pass', exact: true }), p.getByRole('button', { name: 'Drop out' }), p.getByRole('button', { name: /^(End turn|Roll again)$/ }),
]
async function playOne(p: Page): Promise<boolean> {
  for (const button of moves(p)) {
    if ((await button.isVisible()) && (await button.isEnabled({ timeout: 500 }).catch(() => false))) {
      await button.click({ timeout: 3000 }).catch(() => undefined)
      return true
    }
  }
  return false
}

type Opts = { baseURL: string | undefined; viewport?: { width: number; height: number }; hasTouch?: boolean }
const newPage = async (browser: Browser, opts: Opts, clock = false) => {
  const page = await (await browser.newContext(opts)).newPage()
  if (clock) await page.clock.install()
  return page
}
async function openRoom(browser: Browser, opts: Opts, joiners: number, clock = false) {
  const host = await newPage(browser, opts, clock)
  await host.goto('/online')
  await host.getByLabel('Game').selectOption('world-trip')
  await host.getByRole('button', { name: 'Create a room' }).click()
  await expect(host).toHaveURL(/\/room\/[A-Z2-9]{6}\?g=world-trip$/)
  const code = host.url().split('/').pop()!.split('?')[0]
  const others: Page[] = []
  for (let i = 0; i < joiners; i++) {
    const p = await newPage(browser, opts, clock)
    await p.goto(`/room/${code}?g=world-trip`)
    await expect(p.getByRole('region', { name: 'Lobby' })).toBeVisible()
    others.push(p)
  }
  return { host, others, code }
}

test('six travellers join the lobby, the host starts, and a seventh is turned away', async ({ browser, baseURL, isMobile }) => {
  test.setTimeout(240_000)
  const opts: Opts = isMobile ? { baseURL, viewport: { width: 393, height: 851 }, hasTouch: true } : { baseURL }
  const { host, others } = await openRoom(browser, opts, 5)
  const all = [host, ...others]

  await expect(host.getByRole('list', { name: 'Seats' }).getByRole('listitem')).toHaveCount(6)
  await expect(host.getByText('Open seat')).toHaveCount(0)
  await expect(others[4].getByRole('region', { name: 'Lobby' })).toContainText('Player 6 (you)')
  for (const p of others) await expect(p.getByRole('button', { name: 'Start trip' })).toHaveCount(0)

  const late = await newPage(browser, opts)
  await late.goto(host.url())
  await expect(late.getByText('Could not join this room')).toBeVisible()

  await host.getByRole('button', { name: 'Start trip' }).click()
  for (const p of all) {
    await expect(p.getByRole('list', { name: 'Board in travel order' }).getByRole('button')).toHaveCount(40)
    await expect(p.getByRole('list', { name: 'Player balances' }).getByRole('listitem')).toHaveCount(6)
  }
  const late2 = await newPage(browser, opts)
  await late2.goto(host.url())
  await expect(late2.getByText('Could not join this room')).toBeVisible()

  await host.getByRole('button', { name: 'Roll dice' }).click()
  await host.getByRole('button', { name: /^Move \d+ spaces$/ }).click()
  await expect(others[3].locator('.wt-status')).toContainText('Rolled')
  const board = (await host.locator('.wt-board').boundingBox())!
  expect(board.y + board.height).toBeLessThanOrEqual(opts.viewport?.height ?? 720)
  expect(await overflowsHorizontally(host)).toBe(false)
})

test('a traveller who has gone can be removed once their move holds the others up', async ({ browser, baseURL }) => {
  test.setTimeout(240_000)
  const { host, others } = await openRoom(browser, { baseURL }, 2, true)
  const [b, c] = others
  await host.getByRole('button', { name: 'Start trip' }).click()
  await expect(c.getByRole('list', { name: 'Board in travel order' }).getByRole('button')).toHaveCount(40)
  await b.context().close() // Player 2 leaves

  for (let i = 0; i < 300 && !(await host.getByText(/Player 2 has left the room/).isVisible()); i++) {
    if (!(await playOne(host)) && !(await playOne(c))) await host.waitForTimeout(150)
  }
  await expect(host.getByText(/Player 2 has left the room/)).toBeVisible()
  await expect(host.getByRole('button', { name: 'Remove Player 2' })).toHaveCount(0) // not yet: give them time to come back
  await host.clock.runFor(31_000)
  await host.getByRole('button', { name: 'Remove Player 2' }).click()
  await expect(host.getByText(/Player 2 has left the room/)).toHaveCount(0)
  await expect(host.locator('.wt-status')).not.toContainText('Player 2 to move')
  await expect(c.getByRole('list', { name: 'Player balances' })).toContainText('Player 2')
})

for (const size of [{ width: 375, height: 667 }, { width: 1366, height: 650 }, { width: 1280, height: 720 }]) {
  test(`the World Trip lobby and board fit ${size.width}x${size.height}`, async ({ browser, baseURL, isMobile }) => {
    test.skip(isMobile ? size.width > 400 : size.width < 400, 'one size per project')
    test.setTimeout(120_000)
    const { host } = await openRoom(browser, { baseURL, viewport: size, hasTouch: isMobile }, 1)
    const lobby = (await host.locator('.wt-lobby').boundingBox())!
    expect(lobby.y + lobby.height, 'lobby').toBeLessThanOrEqual(size.height)
    await host.getByRole('button', { name: 'Start trip' }).click()
    await expect(host.locator('.wt-board')).toBeVisible()
    const board = (await host.locator('.wt-board').boundingBox())!
    expect(board.y + board.height, 'board').toBeLessThanOrEqual(size.height)
    expect(await overflowsHorizontally(host)).toBe(false)
  })
}
