import { expect, test } from '@playwright/test'
import { expectRows, readTable } from './helpers'

// Play a whole five-round game with real clicks: bid 2 every round, then play the first legal card each turn.
test('a whole game against three computers is played, scored and saved once', async ({ page }) => {
  test.setTimeout(240_000)
  await page.clock.install()
  await page.goto('/play/call-break?seed=e2e-callbreak')
  await expect(page.locator('.cb-hand')).toBeVisible()

  for (let i = 0; i < 1500; i++) {
    if (await page.getByRole('button', { name: 'New game' }).count()) break
    const next = page.getByRole('button', { name: 'Next round' })
    if (await next.count()) { await next.click(); continue }
    const bid = page.getByRole('button', { name: 'Bid 2' })
    if (await bid.count()) { await bid.click(); continue }
    const playable = page.locator('.cb-card[data-legal="true"]')
    if (await playable.count()) { await playable.first().click(); continue }
    await page.clock.runFor(700)
  }

  await expect(page.getByRole('button', { name: 'New game' })).toBeVisible()
  await expect(page.locator('.cb-over tbody tr')).toHaveCount(6) // five rounds and the total
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'call-break' })
  expect(typeof row.won).toBe('boolean')
  const [progress] = await readTable(page, 'progress')
  expect(progress).toMatchObject({ gameId: 'call-break', plays: 1 })

  await page.clock.runFor(10_000)
  await expectRows(page, 'history', 1)
})

test('cards you cannot play are disabled', async ({ page }) => {
  await page.clock.install()
  await page.goto('/play/call-break?seed=e2e-callbreak')
  await expect(page.getByRole('button', { name: 'Bid 2' })).toBeVisible()
  await expect(page.locator('.cb-card:not([disabled])')).toHaveCount(0) // while bidding no card can be played
})
