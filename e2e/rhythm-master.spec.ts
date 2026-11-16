import { expect, test } from '@playwright/test'
import { makeChart } from '../src/games/rhythm/rules'
import { expectRows, readTable } from './helpers'

const KEYS = ['d', 'f', 'j', 'k']

test('playing every note of an easy chart with the keyboard wins and is saved once', async ({ page }) => {
  test.setTimeout(180_000)
  await page.clock.install({ time: new Date('2026-11-15T10:00:00Z') })
  await page.goto('/play/rhythm-master?seed=e2e-rm')
  const field = page.locator('.rm-field')
  await expect(field).toBeVisible()
  await page.getByLabel('Track').selectOption('drift')
  await page.getByLabel('Difficulty').selectOption('easy')
  const chart = makeChart('drift', 'easy', 'e2e-rm')
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(field).toHaveAttribute('data-status', 'playing')
  // Song time is the sum of frames since the first one, about one frame behind the page clock.
  let now = 0
  for (const n of chart) {
    if (n.t - 6 > now) {
      await page.clock.runFor(n.t - 6 - now)
      now = n.t - 6
    }
    await page.keyboard.press(KEYS[n.lane])
  }
  await page.clock.runFor(3000)
  await expect(field).toHaveAttribute('data-status', 'over')
  await expect(page.locator('.game-over').getByRole('heading', { name: /Grade [SAB]/ })).toBeVisible()
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'rhythm-master', won: true })
  await page.clock.runFor(5000)
  await expectRows(page, 'history', 1)
})

test('an untouched song is saved as a loss, and tapping a lane works on a phone-sized screen', async ({ page }) => {
  test.setTimeout(180_000)
  await page.clock.install({ time: new Date('2026-11-15T10:00:00Z') })
  await page.goto('/play/rhythm-master?seed=e2e-rm-idle')
  const field = page.locator('.rm-field')
  await expect(field).toBeVisible()
  await page.getByRole('button', { name: 'Start' }).click()
  const first = makeChart('drift', 'normal', 'e2e-rm-idle')[0]
  await page.clock.runFor(first.t - 6)
  await page.locator(`.rm-lane[data-lane="${first.lane}"]`).dispatchEvent('pointerdown')
  await expect(field).toHaveAttribute('data-combo', '1')
  await page.keyboard.press('p')
  await expect(field).toHaveAttribute('data-status', 'paused')
  await page.keyboard.press('p')
  for (let i = 0; i < 120 && (await field.getAttribute('data-status')) !== 'over'; i++) await page.clock.runFor(1000)
  await expect(field).toHaveAttribute('data-status', 'over')
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'rhythm-master', won: false })
})
