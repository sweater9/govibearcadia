import { expect, test, type Page } from '@playwright/test'

// Two real browser contexts play World Trip through the lobby against the real Worker. Moves are random (the room's dice seed is secret),
// so each player just does the least on their turn until the standings show.

const moves = (p: Page) => [p.getByRole('button', { name: /^Roll (dice|for doubles)$/ }), p.getByRole('button', { name: /^Move \d+ spaces$/ }), p.getByRole('button', { name: 'Pass', exact: true }), p.getByRole('button', { name: 'Drop out' }), p.getByRole('button', { name: /^(End turn|Roll again)$/ })]

test('two players play World Trip from an invite link to the final standings, and a visitor after the start is turned away', async ({ browser, baseURL, isMobile }) => {
  test.setTimeout(420_000)
  const opts = isMobile ? { baseURL, viewport: { width: 393, height: 851 }, hasTouch: true } : { baseURL }
  const a = await (await browser.newContext(opts)).newPage()
  const b = await (await browser.newContext(opts)).newPage()
  await a.goto('/online')
  await a.getByLabel('Game').selectOption('world-trip')
  await a.getByRole('button', { name: 'Create a room' }).click()
  await expect(a).toHaveURL(/\/room\/[A-Z2-9]{6}\?g=world-trip$/)
  const code = a.url().split('/').pop()!.split('?')[0]
  await b.goto(`/room/${code}?g=world-trip`)
  await expect(b.getByRole('region', { name: 'Lobby' })).toContainText('Player 1, host')
  await expect(b.getByRole('button', { name: 'Start trip' })).toHaveCount(0) // only the host starts
  await a.getByRole('button', { name: 'Start trip' }).click()
  await expect(a.getByRole('list', { name: 'Board in travel order' }).getByRole('button')).toHaveCount(40)
  await expect(b.getByRole('list', { name: 'Board in travel order' }).getByRole('button')).toHaveCount(40)

  const c = await (await browser.newContext(opts)).newPage()
  await c.goto(`/room/${code}?g=world-trip`)
  await expect(c.getByText('Could not join this room')).toBeVisible()

  const standings = (p: Page) => p.getByRole('list', { name: 'Final standings' })
  for (let i = 0; i < 1500; i++) {
    if ((await standings(a).isVisible()) && (await standings(b).isVisible())) break
    let clicked = false
    for (const p of [a, b]) {
      for (const button of moves(p)) {
        if (await button.isVisible() && (await button.isEnabled({ timeout: 500 }).catch(() => false))) { await button.click({ timeout: 3000 }).catch(() => undefined); clicked = true; break }
      }
    }
    if (!clicked) await a.waitForTimeout(150)
  }
  await expect(standings(a)).toBeVisible()
  await expect(standings(b)).toBeVisible()
})
