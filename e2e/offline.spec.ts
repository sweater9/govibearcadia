import { expect, test, type Page } from '@playwright/test'
import { GAMES } from './helpers'

async function waitForServiceWorker(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
  // The precache is filled during install, so once the worker controls the page it is complete.
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
}

test('the service worker precaches the app shell and every game chunk', async ({ page }) => {
  await page.goto('/')
  await waitForServiceWorker(page)

  const cached = await page.evaluate(async () => {
    const urls: string[] = []
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) urls.push(new URL(request.url).pathname)
    }
    return urls
  })

  expect(cached).toContain('/index.html')
  for (const { chunk } of GAMES) {
    expect(cached.some((path) => path.startsWith(`/assets/${chunk}-`)), `${chunk} chunk is precached`).toBe(true)
  }
  for (const icon of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'favicon.svg']) {
    expect(cached, icon).toContain(`/${icon}`)
  }
})

test('after one visit the arcade reloads and plays offline, including games never opened', async ({ page, context }) => {
  await page.goto('/')
  await waitForServiceWorker(page)

  await context.setOffline(true)

  await page.reload()
  await expect(page.locator('article.game-card')).toHaveCount(GAMES.length)
  await expect(page.locator('.status')).toContainText('Offline ready')

  // Open every game by direct URL while offline. None were visited online, so their chunks must come from the cache.
  for (const game of GAMES) {
    await page.goto(`/play/${game.id}`)
    await expect(page.getByRole('heading', { level: 1, name: game.title })).toBeVisible()
    await expect(page.locator('.game-shell')).not.toContainText('Game unavailable')
  }

  await page.goto('/play/memory-grid')
  await page.locator('.memory-grid button').first().click()
  await expect(page.locator('.memory-grid button').first()).not.toHaveAttribute('aria-label', 'Hidden card')

  await context.setOffline(false)
  await expect(page.locator('.status')).toContainText('Online')
})

test('progress made offline is saved locally', async ({ page, context }) => {
  await page.goto('/')
  await waitForServiceWorker(page)
  await context.setOffline(true)

  await page.goto('/')
  await page.getByRole('button', { name: 'Add Neon Merge to favorites' }).click()
  // The label flips only after the IndexedDB write has committed; reloading earlier would abort it.
  await expect(page.getByRole('button', { name: 'Remove Neon Merge from favorites' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Remove Neon Merge from favorites' })).toBeVisible()
})

test('the web manifest is installable', async ({ page, request }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBeTruthy()
  const manifest = await (await request.get(href!)).json()

  expect(manifest).toMatchObject({ name: 'GoVibeArcadia', display: 'standalone', start_url: '/' })
  const sizes = (manifest.icons as { sizes: string; type: string; purpose?: string }[]).filter((i) => i.type === 'image/png')
  expect(sizes.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']))
  expect(sizes.some((i) => i.purpose === 'maskable')).toBe(true)
  for (const icon of manifest.icons as { src: string }[]) {
    expect((await request.get(`/${icon.src}`)).ok(), icon.src).toBe(true)
  }
})
