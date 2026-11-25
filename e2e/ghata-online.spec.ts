import { expect, test, type Page } from '@playwright/test'

// Two real browser contexts play Ghata Bara through the lobby against the real Worker. The server rolls the dice and
// plays the two computer seats, so each person just takes whatever legal step is offered on their own turn.

async function step(p: Page): Promise<boolean> {
  const roll = p.getByRole('button', { name: 'Roll', exact: true })
  if (await roll.isEnabled({ timeout: 300 }).catch(() => false)) return roll.click({ timeout: 2000 }).then(() => true, () => false)
  const release = p.getByRole('button', { name: /^Release a pawn/ }).first()
  if (await release.isVisible().catch(() => false)) { return release.click({ timeout: 2000 }).then(() => true, () => false) }
  const movable = p.locator('.gb-sq[data-movable]:not([disabled])').first()
  if (await movable.count()) {
    await movable.click({ timeout: 2000 }).catch(() => undefined)
    const target = p.locator('.gb-sq[data-target]').first()
    if (await target.count()) return target.click({ timeout: 2000 }).then(() => true, () => false)
  }
  return false
}

test('two people play Ghata Bara online with the computer filling the other seats, and a late visitor is turned away', async ({ browser, baseURL, isMobile }) => {
  test.setTimeout(180_000)
  const opts = isMobile ? { baseURL, viewport: { width: 393, height: 851 }, hasTouch: true } : { baseURL }
  const a = await (await browser.newContext(opts)).newPage()
  const b = await (await browser.newContext(opts)).newPage()
  await a.goto('/online')
  await a.getByLabel('Game').selectOption('ghata-bara')
  await a.getByRole('button', { name: 'Create a room' }).click()
  await expect(a).toHaveURL(/\/room\/[A-Z2-9]{6}\?g=ghata-bara$/)
  const code = a.url().split('/').pop()!.split('?')[0]
  await b.goto(`/room/${code}?g=ghata-bara`)
  await expect(b.getByRole('region', { name: 'Lobby' })).toContainText('Player 1, host')
  await expect(b.getByRole('button', { name: 'Start game' })).toHaveCount(0) // only the host starts
  await a.getByLabel('Board size').selectOption('5')
  await a.getByRole('button', { name: 'Start game' }).click()
  for (const p of [a, b]) {
    await expect(p.getByRole('group', { name: 'Ghata Bara board, 5 by 5' })).toBeVisible()
    await expect(p.getByRole('list', { name: 'Seats' }).getByRole('listitem')).toHaveCount(4)
  }
  // Two people sit opposite each other; the other two colours are the computer.
  await expect(a.getByRole('list', { name: 'Seats' })).toContainText('Computer')

  const c = await (await browser.newContext(opts)).newPage()
  await c.goto(`/room/${code}?g=ghata-bara`)
  await expect(c.getByText('Could not join this room')).toBeVisible()

  let acted = 0
  for (let i = 0; i < 120 && acted < 25; i++) {
    let did = false
    for (const p of [a, b]) if (await step(p)) { did = true; acted++; break }
    if (!did) await a.waitForTimeout(150)
  }
  expect(acted).toBeGreaterThanOrEqual(10)
  // Both screens agree on whose turn it is.
  const turn = (p: Page) => p.locator('.gb-seats li[data-turn] strong').first().innerText()
  await expect.poll(async () => (await turn(a)) === (await turn(b))).toBe(true)
})
