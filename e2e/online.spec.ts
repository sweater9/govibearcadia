import { expect, test, type Browser, type Page } from '@playwright/test'
import { expectRows, overflowsHorizontally, readTable } from './helpers'

// Two real browser contexts (two players) through the lobby and room pages, against the real Worker.

async function twoPlayers(browser: Browser, baseURL: string, mobile: boolean, captureSockets = false) {
  const opts = mobile ? { baseURL, viewport: { width: 393, height: 851 }, hasTouch: true } : { baseURL }
  const a = await (await browser.newContext(opts)).newPage()
  const b = await (await browser.newContext(opts)).newPage()
  await a.goto('/online')
  await a.getByRole('button', { name: 'Create a room' }).click()
  await expect(a).toHaveURL(/\/room\/[A-Z2-9]{6}$/)
  const code = a.url().split('/').pop()!
  if (captureSockets) {
    // Remember every WebSocket the page opens, so a test can drop the connection the way a flaky network would.
    await b.addInitScript(() => {
      const w = window as unknown as { __sockets: WebSocket[] }
      w.__sockets = []
      const Original = WebSocket
      window.WebSocket = class extends Original {
        constructor(...args: ConstructorParameters<typeof WebSocket>) {
          super(...args)
          w.__sockets.push(this)
        }
      }
    })
  }
  await b.goto(`/room/${code}`) // the invite link
  return { a, b, code }
}
const status = (p: Page) => p.locator('.c4-status')
const col = (p: Page, n: number) => p.getByRole('button', { name: `Drop in column ${n}` })

test('the lobby validates codes and explains when online play is unavailable', async ({ page }) => {
  await page.goto('/online')
  await page.getByLabel('Room code').fill('abc')
  await page.getByRole('button', { name: 'Join' }).click()
  await expect(page.getByRole('alert')).toContainText('6 letters and numbers')
  await page.getByLabel('Room code').fill('abc0ef') // 0 is not in the alphabet
  await page.getByRole('button', { name: 'Join' }).click()
  await expect(page.getByRole('alert')).toContainText('6 letters and numbers')
  await page.getByLabel('Room code').fill('k7m-2pq')
  await page.getByRole('button', { name: 'Join' }).click()
  await expect(page).toHaveURL(/\/room\/K7M2PQ$/)

  await page.route('**/api/rooms', (route) => route.abort())
  await page.goto('/online')
  await page.getByRole('button', { name: 'Create a room' }).click()
  await expect(page.getByRole('alert')).toContainText('not available right now')
})

test('two players finish a game from an invite link, the result is saved once for each, and a rematch swaps who starts', async ({ browser, baseURL, isMobile }) => {
  const { a, b, code } = await twoPlayers(browser, baseURL!, !!isMobile)
  await expect(a.getByRole('heading', { name: `Room ${code}` })).toBeVisible()
  await expect(status(a)).toHaveText('Your move')
  await expect(status(b)).toHaveText("Friend's move")
  await expect(col(b, 1)).toBeDisabled()

  for (const [p, n] of [[a, 1], [b, 2], [a, 1], [b, 2], [a, 1], [b, 2], [a, 1]] as const) {
    await expect(col(p, n)).toBeEnabled()
    await col(p, n).click()
  }
  await expect(status(a)).toHaveText('You win!')
  await expect(status(b)).toHaveText('You lose')
  await expect(a.getByLabel('Score')).toHaveText('1 – 0')
  await expect(b.getByLabel('Score')).toHaveText('0 – 1')

  await expectRows(a, 'history', 1)
  await expectRows(b, 'history', 1)
  expect((await readTable(a, 'history'))[0]).toMatchObject({ gameId: 'connect-four', won: true })
  expect((await readTable(b, 'history'))[0]).toMatchObject({ gameId: 'connect-four', won: false, score: 0 })

  // A reload shows the finished round again but must not record it a second time.
  await a.reload()
  await expect(status(a)).toHaveText('You win!')
  await expectRows(a, 'history', 1)

  await a.getByRole('button', { name: 'Rematch' }).click()
  await expect(a.getByRole('button', { name: 'Waiting for your friend…' })).toBeDisabled()
  await b.getByRole('button', { name: 'Accept rematch' }).click()
  await expect(status(b)).toHaveText('Your move') // the other seat starts round 2
  await expect(status(a)).toHaveText("Friend's move")
  await expect(a.getByLabel('Score')).toHaveText('1 – 0')
})

test('reloading mid-game gives the same seat and board back; a third visitor is turned away', async ({ browser, baseURL, isMobile }) => {
  const { a, b, code } = await twoPlayers(browser, baseURL!, !!isMobile)
  await expect(status(a)).toHaveText('Your move')
  await col(a, 4).click()
  await expect(status(b)).toHaveText('Your move')
  await b.reload()
  await expect(status(b)).toHaveText('Your move')
  await expect(b.locator('.c4-cell[data-p="1"]')).toHaveCount(1)

  const c = await (await browser.newContext({ baseURL: baseURL! })).newPage()
  await c.goto(`/room/${code}`)
  await expect(c.getByText('Could not join this room')).toBeVisible()
})

test('a player who loses their connection is shown as gone, and the game resumes when they are back', async ({ browser, baseURL, isMobile }) => {
  const { a, b } = await twoPlayers(browser, baseURL!, !!isMobile, true)
  await expect(status(a)).toHaveText('Your move')
  await col(a, 4).click()
  await expect(status(b)).toHaveText('Your move')

  await b.context().setOffline(true)
  await b.evaluate(() => (window as unknown as { __sockets: WebSocket[] }).__sockets.forEach((ws) => ws.close(3001)))
  await expect(status(b)).toHaveText('Reconnecting…')
  await expect(status(a)).toHaveText('Waiting for your friend…')
  await expect(col(a, 1)).toBeDisabled()

  await b.context().setOffline(false)
  await expect(status(b)).toHaveText('Your move', { timeout: 15_000 })
  await expect(status(a)).toHaveText("Friend's move")
  await col(b, 4).click()
  await expect(status(a)).toHaveText('Your move')
  await expect(a.locator('.c4-cell[data-p="2"]')).toHaveCount(1)
})

test('the room page fits the screen', async ({ page, isMobile }) => {
  await page.goto('/online')
  await page.getByRole('button', { name: 'Create a room' }).click()
  await expect(page.locator('.c4-board')).toBeVisible()
  const sizes = isMobile ? [{ width: 375, height: 667 }] : [{ width: 1366, height: 650 }, { width: 1280, height: 720 }]
  for (const viewport of sizes) {
    await page.setViewportSize(viewport)
    const box = await page.locator('.c4-board').boundingBox()
    expect(box!.y + box!.height, `${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(viewport.height)
    expect(await overflowsHorizontally(page)).toBe(false)
  }
})
