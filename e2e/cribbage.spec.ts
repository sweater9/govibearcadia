import { expect, test } from '@playwright/test'
import { expectRows, readTable } from './helpers'

const THINK = 650

test('plays a whole game against the computer with real input and saves it once', async ({ page }) => {
  test.setTimeout(420_000)
  await page.clock.install({ time: new Date('2026-11-15T10:00:00Z') })
  await page.goto('/play/cribbage?seed=e2e-cb')
  await expect(page.locator('.cb-felt')).toBeVisible()
  await page.clock.pauseAt(new Date('2026-11-15T10:00:30Z'))
  const again = page.getByRole('button', { name: 'Play again' })
  const send = page.getByRole('button', { name: /^Send to/ })
  const cont = page.getByRole('button', { name: /^(Continue|Next deal)$/ })
  const playable = page.locator('button[data-card]:not([disabled])')
  for (let guard = 0; guard < 3000 && !(await again.isVisible()); guard++) {
    if (await send.isVisible()) {
      await playable.nth(0).click()
      await playable.nth(1).click()
      await send.click()
    } else if (await cont.isVisible()) await cont.click()
    else if ((await playable.count()) > 0) await playable.first().click()
    await page.clock.runFor(THINK)
  }
  await expect(again).toBeVisible()
  const bars = await page.locator('[role="progressbar"]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('aria-valuenow'))))
  expect(Math.max(...bars)).toBe(121)
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'cribbage', won: bars[0] === 121 })
  await page.clock.runFor(5000)
  await expectRows(page, 'history', 1)
})

test('the keys 1 to 6 choose the crib cards and Escape clears them', async ({ page }) => {
  await page.goto('/play/cribbage?seed=e2e-cb-keys')
  await expect(page.locator('button[data-card]')).toHaveCount(6)
  await page.keyboard.press('1')
  await page.keyboard.press('2')
  await expect(page.locator('button[data-card][aria-pressed="true"]')).toHaveCount(2)
  await page.keyboard.press('Escape')
  await expect(page.locator('button[data-card][aria-pressed="true"]')).toHaveCount(0)
  await page.keyboard.press('3')
  await page.keyboard.press('4')
  await page.getByRole('button', { name: /^Send to/ }).click()
  await expect(page.getByText(/^Count/)).toBeVisible()
  await expect(page.locator('button[data-card]')).toHaveCount(4)
})
