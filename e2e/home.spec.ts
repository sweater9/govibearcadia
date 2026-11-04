import { expect, test } from '@playwright/test'
import { GAMES, overflowsHorizontally, trackHosts } from './helpers'

test('home page lists every game and the arcade branding', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/GoVibeArcadia/)
  await expect(page.locator('article.game-card')).toHaveCount(GAMES.length)
  for (const game of GAMES) await expect(page.locator('article.game-card').getByRole('heading', { name: game.title })).toBeVisible()
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
  await expect(filters.first()).toHaveText(`All ${GAMES.length}`)
  const cats = [...new Set(GAMES.map((game) => game.category))]
  await expect(filters).toHaveText(['All', ...cats].map((c) => `${c} ${c === 'All' ? GAMES.length : GAMES.filter((g) => g.category === c).length}`))

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

test('the hero is left-aligned with the trust line, and the start-here cards are on screen without scrolling far', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'desktop layout')
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/')
  await expect(page.locator('.hero .trust')).toHaveText(/No tracking, no account, works offline once loaded/)
  const copy = await page.locator('.hero-copy').boundingBox()
  const h1 = await page.locator('.hero h1').boundingBox()
  expect(Math.abs(h1!.x - copy!.x)).toBeLessThan(2) // starts at the left edge of the content column, not centred
  expect(h1!.width).toBeLessThan(700) // headline measure is about twelve characters
  const daily = await page.locator('.today').boundingBox()
  expect(daily!.y).toBeLessThan(900)
})

test('exactly the four games with online rooms carry the Online badge, and the phone page does not overflow', async ({ page }) => {
  await page.goto('/')
  const badged = page.locator('article.game-card', { has: page.locator('.online-badge') })
  await expect(badged).toHaveCount(4)
  for (const title of ['Connect Four', 'Tic-Tac-Toe', 'Checkers', 'Battleship']) {
    await expect(badged.getByRole('heading', { name: title })).toBeVisible()
  }
  expect(await overflowsHorizontally(page)).toBe(false)
  await expect(page.getByText(`${GAMES.length} free games`)).toBeVisible()
})
