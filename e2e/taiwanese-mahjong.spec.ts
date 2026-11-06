import { expect, test, type Page } from '@playwright/test'
import { expectRows, readTable } from './helpers'

async function begin(page: Page) {
  await page.goto('/play/taiwanese-mahjong')
  await page.getByLabel('Length').selectOption('single')
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByTestId('mj-hand')).toBeVisible()
}

test('a whole hand against the computers, played with real taps, is saved once', async ({ page }) => {
  test.setTimeout(240_000)
  await page.clock.install()
  await begin(page)
  const over = page.getByRole('dialog', { name: 'Hand result' })
  for (let i = 0; i < 4000 && !(await over.isVisible()); i++) {
    const win = page.getByRole('button', { name: /^Win/ })
    const pass = page.getByRole('button', { name: 'Pass', exact: true })
    if (await win.first().isVisible()) await win.first().click()
    else if (await pass.isVisible()) await pass.click()
    else if (await page.getByText(/Your turn/).isVisible()) {
      const tile = page.getByTestId('mj-hand').locator('button').first()
      await tile.click()
      await tile.click()
    } else await page.clock.runFor(400)
  }
  await expect(over).toBeVisible()
  await expect(page.getByRole('status')).toContainText('The match is over')
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row.gameId).toBe('taiwanese-mahjong')
  const scores = await Promise.all([0, 1, 2, 3].map((i) => page.getByTestId(`mj-score-${i}`).first().textContent().catch(() => null)))
  expect(scores.filter(Boolean).length).toBeGreaterThan(0)
})

test('the saved game resumes after a reload', async ({ page }) => {
  await begin(page)
  const tile = page.getByTestId('mj-hand').locator('button').first()
  await tile.click()
  await tile.click()
  await expect(page.getByTestId('mj-pool').locator('.mj-tile').first()).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Resume saved game' }).click()
  await expect(page.getByTestId('mj-hand')).toBeVisible()
  await expect(page.getByTestId('mj-pool').locator('.mj-tile').first()).toBeVisible()
})

for (const [width, height] of [[1440, 800], [1366, 650], [1280, 720], [375, 667]]) {
  test(`match screen fits ${width}x${height}`, async ({ page, isMobile }) => {
    test.skip(width === 375 ? !isMobile : !!isMobile, 'laptop sizes run in the desktop project, the phone size in the phone project')
    await page.setViewportSize({ width, height })
    await begin(page)
    const nav = (await page.locator('.nav').boundingBox())!
    for (const sel of ['.mj-opps', '.mj-pool', '.mj-hand', '.mj-wrap > .mj-row']) {
      const b = (await page.locator(sel).last().boundingBox())!
      expect(b.y, `${sel} below the header`).toBeGreaterThanOrEqual(nav.y + nav.height - 1)
      expect(b.y + b.height, `${sel} inside the viewport`).toBeLessThanOrEqual(height)
      expect(b.x + b.width, `${sel} inside the width`).toBeLessThanOrEqual(width + 1)
    }
  })
}
