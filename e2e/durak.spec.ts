import { expect, test } from '@playwright/test'
import { expectRows, readTable } from './helpers'

const THINK = 650

test('plays a whole game against the computer with real input and saves it once', async ({ page }) => {
  test.setTimeout(420_000)
  await page.clock.install({ time: new Date('2026-11-15T10:00:00Z') })
  await page.goto('/play/durak?seed=e2e-du')
  await expect(page.locator('.du-felt')).toBeVisible()
  await page.clock.pauseAt(new Date('2026-11-15T10:00:30Z'))
  const again = page.getByRole('button', { name: 'Play again' })
  const takeBtn = page.getByRole('button', { name: 'Take the cards' })
  const end = page.getByRole('button', { name: /^(End the bout|Done adding)$/ })
  const usable = page.locator('.du-hand button[data-card]:not([disabled])')
  for (let guard = 0; guard < 3000 && !(await again.isVisible()); guard++) {
    if ((await usable.count()) > 0) await usable.first().click()
    else if (await takeBtn.isVisible()) await takeBtn.click()
    else if (await end.isVisible()) await end.click()
    await page.clock.runFor(THINK)
  }
  await expect(again).toBeVisible()
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'durak' })
  await page.clock.runFor(5000)
  await expectRows(page, 'history', 1)
})

test('keys: a number plays a glowing card, and the table and hand stay on screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/play/durak?seed=e2e-du-keys')
  await expect(page.locator('.du-hand button[data-card]')).toHaveCount(6)
  // Let the computer lead if it attacks first, then it is our move.
  await expect(page.locator('.du-hand button[data-card]:not([disabled])').first()).toBeVisible({ timeout: 10_000 })
  const before = await page.locator('.du-felt button[data-card], .du-felt .du-pair .du-card').count()
  const first = await page.locator('.du-hand button[data-card]:not([disabled])').first().getAttribute('data-card')
  const index = await page.locator('.du-hand button[data-card]').evaluateAll((els, id) => els.findIndex((e) => (e as HTMLElement).dataset.card === id), first)
  await page.keyboard.press(String(index + 1))
  await expect.poll(async () => page.locator('.du-felt button[data-card], .du-felt .du-pair .du-card').count()).not.toBe(before)
  const box = await page.locator('.du-felt').boundingBox()
  expect(box!.y + box!.height).toBeLessThanOrEqual(667)
})
