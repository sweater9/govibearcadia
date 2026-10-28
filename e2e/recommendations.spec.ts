import { expect, test } from '@playwright/test'
import { overflowsHorizontally } from './helpers'

test('a new player sees friendly starters', async ({ page }) => {
  await page.goto('/')
  const recs = page.getByLabel('Recommended for you')
  await expect(recs).toContainText('Start here')
  await expect(recs.locator('li')).toHaveCount(3)
  await expect(recs.locator('li').first()).toContainText('Easy to pick up')
  await recs.getByRole('link').first().click()
  await expect(page).toHaveURL(/\/play\//)
})

test('recommendations follow what you play: lots of Logic suggests another Logic game, never the one you just played', async ({ page }) => {
  await page.goto('/passport')
  const runs = Array.from({ length: 6 }, (_, i) => ({ gameId: 'carve', score: 100, won: true, playedAt: `2026-10-2${i}T09:00:00.000Z` }))
  const backup = { app: 'govibearcadia', version: 1, exportedAt: '2026-10-28T10:00:00.000Z', progress: [], favorites: [], history: runs }
  await page.getByLabel('Import file').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })
  await expect(page.getByText('Imported 6 new runs')).toBeVisible()

  await page.goto('/')
  const recs = page.getByLabel('Recommended for you')
  await expect(recs).toContainText('Recommended for you')
  await expect(recs.locator('li').first()).toContainText('You play a lot of Logic')
  await expect(recs).not.toContainText('Carve')
  expect(await overflowsHorizontally(page)).toBe(false)
  await recs.locator('li').first().getByRole('link').click()
  await expect(page).toHaveURL(/\/play\/(minesweeper|twofold)/)
})
