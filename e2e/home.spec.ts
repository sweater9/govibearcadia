import { expect, test } from '@playwright/test'
import { GAMES, overflowsHorizontally, trackHosts } from './helpers'

test('home page lists every game and the arcade branding', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/GoVibeArcadia/)
  await expect(page.locator('article.game-card')).toHaveCount(GAMES.length)
  for (const game of GAMES) await expect(page.getByRole('heading', { name: game.title })).toBeVisible()
})

test('search narrows the collection and explains an empty result', async ({ page }) => {
  await page.goto('/')
  const search = page.getByLabel('Search games')

  await search.fill('pulse')
  await expect(page.locator('article.game-card')).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'Pulse Tap' })).toBeVisible()

  await search.fill('zzzz')
  await expect(page.locator('article.game-card')).toHaveCount(0)
  await expect(page.getByRole('status')).toContainText('No games match')

  await search.fill('')
  await expect(page.locator('article.game-card')).toHaveCount(GAMES.length)
})

test('category filters come from the registry and combine with search', async ({ page }) => {
  await page.goto('/')
  const filters = page.locator('.filters button')
  await expect(filters.first()).toHaveText('All')
  await expect(filters).toHaveText(['All', 'Puzzle', 'Focus', 'Arcade'])

  await filters.filter({ hasText: 'Focus' }).click()
  await expect(page.locator('article.game-card')).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'Memory Grid' })).toBeVisible()

  await page.getByLabel('Search games').fill('merge') // no Focus game matches
  await expect(page.locator('article.game-card')).toHaveCount(0)
})

test('the app makes no third-party requests', async ({ page }) => {
  const hosts = trackHosts(page)
  await page.goto('/')
  for (const game of GAMES) {
    await page.goto(`/play/${game.id}`)
    await expect(page.getByRole('heading', { level: 1, name: game.title })).toBeVisible()
  }
  expect([...hosts]).toEqual(['localhost'])
})

test('pages fit the viewport without sideways scrolling', async ({ page }) => {
  for (const path of ['/', ...GAMES.map((g) => `/play/${g.id}`)]) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    expect(await overflowsHorizontally(page), `${path} overflows horizontally`).toBe(false)
  }
})

test('unknown games redirect home', async ({ page }) => {
  await page.goto('/play/does-not-exist')
  await expect(page).toHaveURL('/')
})
