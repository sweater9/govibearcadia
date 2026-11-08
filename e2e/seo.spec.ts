import { expect, test } from '@playwright/test'

test('head tags, robots, sitemap and share image are served', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og-image\.png$/)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https:\/\//)
  const robots = await request.get('/robots.txt')
  expect(robots.ok()).toBe(true)
  expect(await robots.text()).toContain('Sitemap:')
  const sitemap = await request.get('/sitemap.xml')
  expect(sitemap.ok()).toBe(true)
  expect(await sitemap.text()).toContain('/play/')
  const img = await request.get('/og-image.png')
  expect(img.ok()).toBe(true)
  expect(img.headers()['content-type']).toContain('image/png')
})

test('a game page sets its own title', async ({ page }) => {
  await page.goto('/play/memory-grid')
  await expect(page).toHaveTitle(/Memory Grid/)
})
