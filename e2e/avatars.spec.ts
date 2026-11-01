import { expect, test, type Page } from '@playwright/test'
import { overflowsHorizontally } from './helpers'

/** Imports `n` won runs (25 XP each) so the passport reaches a given level. */
async function giveXp(page: Page, wins: number) {
  const history = Array.from({ length: wins }, (_, i) => ({ gameId: 'twofold', score: 100, won: true, playedAt: `2026-09-01T09:${String(i % 60).padStart(2, '0')}:${String(Math.floor(i / 60)).padStart(2, '0')}.000Z` }))
  const backup = { app: 'govibearcadia', version: 1, exportedAt: '2026-10-28T10:00:00.000Z', progress: [], favorites: [], history }
  await page.getByLabel('Import file').setInputFiles({ name: 'xp.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })
  await expect(page.getByText(`Imported ${wins} new runs`)).toBeVisible()
}
const option = (page: Page, id: string) => page.locator(`[data-avatar-option="${id}"]`)
const headGlyph = (page: Page) => page.locator('.pp-head .avatar').innerText()

test('a new player has Spark, the other level 1 avatars are free, and the rest are locked and labelled', async ({ page }) => {
  await page.goto('/passport')
  await expect(option(page, 'spark')).toHaveAttribute('aria-checked', 'true')
  expect(await headGlyph(page)).toBe('✦')
  for (const id of ['orbit', 'wave', 'cross']) await expect(option(page, id)).toBeEnabled()
  for (const [id, level] of [['anchor', 2], ['burst', 3], ['crown', 5], ['star', 8]] as const) {
    await expect(option(page, id)).toBeDisabled()
    await expect(option(page, id)).toHaveAttribute('aria-label', new RegExp(`unlocks at level ${level}`))
  }
  expect(await overflowsHorizontally(page)).toBe(false)
})

test('a free avatar can be picked and survives a reload', async ({ page }) => {
  await page.goto('/passport')
  await option(page, 'wave').click()
  await expect(option(page, 'wave')).toHaveAttribute('aria-checked', 'true')
  expect(await headGlyph(page)).toBe('∿')
  await page.reload()
  await expect(option(page, 'wave')).toHaveAttribute('aria-checked', 'true')
  expect(await headGlyph(page)).toBe('∿')
})

test('avatars unlock with level, and a locked one saved in storage is not shown', async ({ page }) => {
  await page.goto('/passport')
  await page.evaluate(() => localStorage.setItem('govibearcadia.avatar', 'crown'))
  await page.reload()
  await expect(option(page, 'spark')).toHaveAttribute('aria-checked', 'true') // level 1: the crown is locked, so the default shows
  expect(await headGlyph(page)).toBe('✦')
  await giveXp(page, 40) // level 5
  await expect(page.getByRole('heading', { name: 'Level 5' })).toBeVisible()
  await expect(option(page, 'crown')).toBeEnabled()
  await expect(option(page, 'star')).toBeDisabled() // level 8
  await option(page, 'crown').click()
  await page.reload()
  await expect(option(page, 'crown')).toHaveAttribute('aria-checked', 'true')
  expect(await headGlyph(page)).toBe('♛')
})

test('the avatar stays on the device: it is not part of any request to the server', async ({ page }) => {
  const urls: string[] = []
  page.on('request', (r) => urls.push(r.url() + (r.postData() ?? '')))
  await page.goto('/passport')
  await option(page, 'orbit').click()
  await page.goto('/leaderboard')
  await page.getByRole('button', { name: 'Join the leaderboards' }).click()
  await expect(page.locator('.pp-head .avatar')).toContainText('◎')
  expect(urls.some((u) => /orbit|avatar/i.test(u.replace(/assets\/.*avatar.*/i, '')))).toBe(false)
})
