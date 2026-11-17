import { expect, test } from '@playwright/test'

test('a game address is served with that game\'s own title, preview picture and structured data', async ({ request }) => {
  const res = await request.get('/play/pulse-tap')
  expect(res.status()).toBe(200)
  const html = await res.text()
  expect(html).toContain('<title>Pulse Tap: play free online · GoVibeArcade</title>')
  expect(html).toContain('<link rel="canonical" href="https://govibearcade.com/play/pulse-tap" />')
  expect(html).toContain('<meta property="og:image" content="https://govibearcade.com/og/pulse-tap.png" />')
  expect(html).toContain('"@type": "VideoGame"')
  expect(html).not.toMatch(/__[A-Z_]+__/)

  const image = await request.get('/og/pulse-tap.png')
  expect(image.status()).toBe(200)
  expect(image.headers()['content-type']).toContain('image/png')
})

test('the home page keeps the site-wide head, and an unknown game still falls back to the app', async ({ request }) => {
  const home = await (await request.get('/')).text()
  expect(home).toContain('<title>GoVibeArcade: free browser games, no ads, no sign-up</title>')
  expect(home).toContain('"@type": "WebSite"')
  const unknown = await request.get('/play/not-a-game')
  expect(unknown.status()).toBe(200)
  expect(await unknown.text()).toContain('<div id="root"></div>')
})

test('the game page explains the game and still offers similar ones', async ({ page }) => {
  await page.goto('/play/pulse-tap')
  await expect(page.getByRole('heading', { name: 'How to play Pulse Tap' })).toBeVisible()
  await expect(page.getByText('Tap as many as you can in thirty seconds')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'More like this' })).toBeVisible()
})

test('a keyboard-only page load of a game still shows its controls', async ({ page }) => {
  await page.goto('/play/neon-merge')
  await expect(page.getByText('Arrow keys, or the on-screen arrow pad.')).toBeVisible()
})
