import { expect, test } from '@playwright/test'
import { expectRows, readTable } from './helpers'

const THINK = 700

test('plays a whole match against the computer with real input and saves it once', async ({ page }) => {
  test.setTimeout(420_000)
  await page.clock.install({ time: new Date('2026-11-15T10:00:00Z') })
  await page.goto('/play/scopa?seed=e2e-sc')
  await expect(page.locator('.sc-felt')).toBeVisible()
  await page.clock.pauseAt(new Date('2026-11-15T10:00:30Z'))
  const again = page.getByRole('button', { name: 'Play again' })
  const nextHand = page.getByRole('button', { name: 'Next hand' })
  const choices = page.getByRole('button', { name: /^\d+\. Take/ })
  const playable = page.locator('button[data-card]:not([disabled])')
  for (let guard = 0; guard < 3000 && !(await again.isVisible()); guard++) {
    if (await nextHand.isVisible()) await nextHand.click()
    else if ((await choices.count()) > 0) await choices.first().click()
    else if ((await playable.count()) > 0) await playable.first().click()
    await page.clock.runFor(THINK)
  }
  await expect(again).toBeVisible()
  const text = (await page.locator('.sc-score').innerText()).replace(/\s+/g, ' ')
  const nums = [...text.matchAll(/(You|Computer) (\d+)/g)].map((m) => Number(m[2]))
  expect(Math.max(...nums)).toBeGreaterThanOrEqual(11)
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'scopa', won: nums[0] > nums[1] })
  await page.clock.runFor(5000)
  await expectRows(page, 'history', 1)
})

test('the keys choose cards and the scoring breakdown appears after a hand', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-15T10:00:00Z') })
  await page.goto('/play/scopa?seed=e2e-sc-keys')
  await expect(page.locator('button[data-card]')).toHaveCount(3)
  await page.clock.pauseAt(new Date('2026-11-15T10:00:30Z'))
  const choices = page.getByRole('button', { name: /^\d+\. Take/ })
  for (let guard = 0; guard < 400 && !(await page.getByText('Hand scored').isVisible()); guard++) {
    if ((await choices.count()) > 0) await page.keyboard.press('1')
    else if ((await page.locator('button[data-card]:not([disabled])').count()) > 0) await page.keyboard.press('1')
    await page.clock.runFor(THINK)
  }
  await expect(page.getByText('Hand scored')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next hand' })).toBeVisible()
})
