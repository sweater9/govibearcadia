import { expect, test } from '@playwright/test'
import { applyAction, newGame } from '../src/games/worldtrip/rules'
import { expectRows, readTable } from './helpers'

test('plays a complete match offline, resumes after a reload and records the result once', async ({ page, context }) => {
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  await page.goto('/play/world-trip?seed=trip-test')
  await expect(page.getByRole('list', { name: 'Board in travel order' }).getByRole('button')).toHaveCount(40)
  await page.getByRole('button', { name: 'Start match' }).click()
  for (let turn = 0; turn < 24; turn++) {
    await page.getByRole('button', { name: 'Roll dice' }).click()
    const pass = page.getByRole('button', { name: 'Pass', exact: true })
    if (await pass.isVisible()) await pass.click()
    if (turn === 0) {
      await page.reload()
      await expect(page.locator('.wt-status')).toContainText('Round 1 of 12 · Player 1. Rolled')
    }
    await page.getByRole('button', { name: 'End turn' }).click()
  }
  await expect(page.getByRole('list', { name: 'Final standings' })).toBeVisible()
  await expectRows(page, 'history', 1)
  await page.reload()
  await expect(page.getByRole('list', { name: 'Final standings' })).toBeVisible()
  expect(await readTable(page, 'history')).toMatchObject([{ gameId: 'world-trip', won: true }])
})

test('a buyer can accept a saved offer for a stop', async ({ page }) => {
  const seed = Array.from({ length: 60 }, (_, i) => `deal-${i}`).find((s) => applyAction(newGame(2, s), { type: 'roll' }).phase === 'buy')!
  await page.goto(`/play/world-trip?seed=${seed}`)
  await page.getByRole('button', { name: 'Start match' }).click()
  await page.getByRole('button', { name: 'Roll dice' }).click()
  await page.getByRole('button', { name: /^Claim / }).click()
  await page.getByText('Deals and visitor centres', { exact: true }).click()
  await page.getByLabel('Price (cr)').fill('150')
  await page.getByRole('button', { name: 'Offer sale' }).click()
  await page.reload()
  await expect(page.getByRole('region', { name: 'Pending offer' })).toContainText('Pass the device to Player 2')
  await page.getByRole('button', { name: 'Accept offer' }).click()
  await expect(page.getByRole('list', { name: 'Player balances' })).toContainText('Player 2')
  await expect(page.getByRole('list', { name: 'Board in travel order' }).getByRole('button', { name: /owned by Player 2/ })).toHaveCount(1)
})

test('the board and the action buttons are on screen at phone size', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/play/world-trip?seed=fit')
  await page.getByRole('button', { name: 'Start match' }).click()
  for (const sel of ['.wt-board', '.wt-actions button']) {
    const box = (await page.locator(sel).first().boundingBox())!
    expect(box.y + box.height, `${sel} inside the viewport`).toBeLessThanOrEqual(667)
  }
})
