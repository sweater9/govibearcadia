import { expect, test, type Page } from '@playwright/test'
import { overflowsHorizontally } from './helpers'

const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme)
const filter = (page: Page) => page.evaluate(() => getComputedStyle(document.documentElement).filter)

/** Imports `n` won runs (25 XP each) so the passport reaches a given level. */
async function giveXp(page: Page, wins: number) {
  const history = Array.from({ length: wins }, (_, i) => ({ gameId: 'twofold', score: 100, won: true, playedAt: `2026-09-01T09:${String(i % 60).padStart(2, '0')}:${String(Math.floor(i / 60)).padStart(2, '0')}.000Z` }))
  const backup = { app: 'govibearcadia', version: 1, exportedAt: '2026-10-28T10:00:00.000Z', progress: [], favorites: [], history }
  await page.getByLabel('Import file').setInputFiles({ name: 'xp.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })
  await expect(page.getByText(`Imported ${wins} new runs`)).toBeVisible()
}

test('a new player has Neon, with the other themes locked and labelled', async ({ page }) => {
  await page.goto('/passport')
  expect(await theme(page)).toBe('neon')
  await expect(page.locator('[data-theme-option="neon"]')).toHaveAttribute('aria-checked', 'true')
  for (const [id, level] of [['ocean', 2], ['forest', 3], ['ember', 5]] as const) {
    await expect(page.locator(`[data-theme-option="${id}"]`)).toBeDisabled()
    await expect(page.locator(`[data-theme-option="${id}"]`)).toContainText(`Unlocks at level ${level}`)
  }
  expect(await overflowsHorizontally(page)).toBe(false)
})

test('themes unlock with level, apply instantly and survive a reload', async ({ page }) => {
  await page.goto('/passport')
  await giveXp(page, 40) // 1000 XP: level 5, everything unlocked
  await expect(page.getByRole('heading', { name: 'Level 5' })).toBeVisible()

  await page.locator('[data-theme-option="ember"]').click()
  expect(await theme(page)).toBe('ember')
  expect(await filter(page)).toContain('hue-rotate')
  await expect(page.locator('[data-theme-option="ember"]')).toHaveAttribute('aria-checked', 'true')

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Level 5' })).toBeVisible()
  expect(await theme(page)).toBe('ember')
  await page.goto('/')
  expect(await theme(page)).toBe('ember')

  await page.goto('/passport')
  await page.locator('[data-theme-option="neon"]').click()
  expect(await theme(page)).toBe('neon')
  expect(await filter(page)).toBe('none')
})

test('a locked theme smuggled into storage is ignored', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('govibearcadia.theme', 'ember'))
  await page.goto('/')
  await expect.poll(() => theme(page)).toBe('neon') // new player: level 1, ember is locked
  await page.addInitScript(() => localStorage.setItem('govibearcadia.theme', '<img src=x>'))
  await page.reload()
  expect(await theme(page)).toBe('neon')
})
