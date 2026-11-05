import { expect, test, type Page } from '@playwright/test'
import { startingCoins } from '../src/games/carrom/rules'
import { expectRows, readTable } from './helpers'

// Carrom: the real Phaser board and physics in a real browser, driven with the page's own controls.

const KEY = 'govibearcadia.carrom'
type Saved = { state: { turn: number; coins: { id: number; x: number; y: number; pocketed: boolean }[]; scores: number[] } } | null
const saved = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null') as Saved, KEY)

async function begin(page: Page, opponent: 'Pass and play' | 'Play the computer') {
  await page.goto('/play/carrom')
  await page.getByRole('button', { name: opponent }).click()
  await page.getByRole('button', { name: 'Start match' }).click()
  await expect(page.locator('.cm-board canvas')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Strike' })).toBeEnabled()
}

test('a strike runs the physics and the coins end up somewhere new', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await begin(page, 'Pass and play')
  await page.getByLabel('Power').fill('100')
  const start = startingCoins()
  await page.getByRole('button', { name: 'Strike' }).click()
  await expect.poll(async () => (await saved(page))?.state.coins.some((c, i) => Math.hypot(c.x - start[i].x, c.y - start[i].y) > 5), { timeout: 30_000 }).toBe(true)
  const s = (await saved(page))!.state
  expect(s.coins.every((c) => c.pocketed || (c.x > 0 && c.x < 740 && c.y > 0 && c.y < 740))).toBe(true)
  expect(errors).toEqual([])
})

test('the computer takes its turn after yours', async ({ page }) => {
  await begin(page, 'Play the computer')
  await page.getByRole('button', { name: 'Strike' }).click()
  await expect(page.getByRole('status')).toContainText('Computer to shoot', { timeout: 30_000 })
  await expect(page.getByRole('status')).toContainText('You to shoot', { timeout: 60_000 })
})

test('finishing a match saves the result once', async ({ page }) => {
  await begin(page, 'Pass and play')
  await page.getByRole('button', { name: 'Finish match' }).click()
  await expect(page.getByRole('status')).toContainText('drawn')
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row.gameId).toBe('carrom')
})

test('touch: dragging back from the striker aims and fires', async ({ page }) => {
  await begin(page, 'Pass and play')
  const box = (await page.locator('.cm-board canvas').boundingBox())!
  const k = box.width / 740
  const sx = box.x + 370 * k
  const sy = box.y + 635 * k
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx, sy + 150 * k, { steps: 6 })
  await page.mouse.up()
  const start = startingCoins()
  await expect.poll(async () => (await saved(page))?.state.coins.some((c, i) => Math.hypot(c.x - start[i].x, c.y - start[i].y) > 5), { timeout: 30_000 }).toBe(true)
})

// The setup screen is covered by PLAY_AREA in layout.spec.ts; here the match screen: board, controls and buttons all on screen.
for (const [width, height] of [[1440, 800], [1366, 650], [1280, 720], [375, 667]]) {
  test(`match screen fits ${width}x${height}`, async ({ page, isMobile }) => {
    test.skip(width === 375 ? !isMobile : !!isMobile, 'laptop sizes run in the desktop project, the phone size in the phone project')
    await page.setViewportSize({ width, height })
    await begin(page, 'Pass and play')
    const nav = (await page.locator('.nav').boundingBox())!
    for (const sel of ['.cm-board', '.cm-controls', '.cm-row']) {
      const b = (await page.locator(sel).last().boundingBox())!
      expect(b.y, `${sel} below the header`).toBeGreaterThanOrEqual(nav.y + nav.height - 1)
      expect(b.y + b.height, `${sel} inside the viewport`).toBeLessThanOrEqual(height)
    }
    expect((await page.locator('.cm-board').boundingBox())!.width).toBeGreaterThan(200)
  })
}
