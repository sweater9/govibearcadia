import { expect, test } from '@playwright/test'
import { applyAction, newGame } from '../src/games/bazaar/rules'
import { expectRows, readTable } from './helpers'

test('a buyer can accept a saved offer for an upgraded property', async ({ page }) => {
  const seed = Array.from({ length: 30 }, (_, index) => `trade-${index}`)
    .find((candidate) => applyAction(newGame(2, candidate), { type: 'roll' }).phase === 'buy')!
  await page.goto(`/play/bazaar?seed=${seed}`)
  await page.getByRole('button', { name: 'Start match' }).click()
  await page.getByRole('button', { name: 'Roll dice' }).click()
  await page.getByRole('button', { name: /^Buy / }).click()
  await page.getByText('Manage properties', { exact: true }).click()
  await page.getByRole('button', { name: /Upgrade/ }).click()
  await page.getByLabel('Price (₹)').fill('160')
  await page.getByRole('button', { name: 'Offer sale' }).click()
  await page.reload()
  await expect(page.getByRole('region', { name: 'Pending property offer' })).toContainText('Pass the device to Player 2')
  await page.getByRole('button', { name: 'Accept offer' }).click()
  await expect(page.getByRole('list', { name: 'Player balances' })).toContainText('Player 2 · ₹240 cash')
  await expect(page.locator('.bazaar-board')).toContainText(/P2 · ₹\d+ rent/)
})

test('plays a complete match offline, resumes after reload and records the result once', async ({ page, context }) => {
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  await page.goto('/play/bazaar?seed=market-test')
  await expect(page.getByRole('list', { name: 'Market board in travel order' }).getByRole('listitem')).toHaveCount(16)
  await page.getByRole('button', { name: 'Start match' }).click()
  for (let turn = 0; turn < 24; turn++) {
    await page.getByRole('button', { name: 'Roll dice' }).click()
    const pass = page.getByRole('button', { name: 'Pass on purchase' })
    if (await pass.isVisible()) await pass.click()
    if (turn === 0) {
      await page.reload()
      await expect(page.locator('.bazaar-status')).toContainText('Round 1 of 12 · Player 1. Rolled')
    }
    await page.getByRole('button', { name: 'End turn' }).click()
  }
  await expect(page.getByRole('list', { name: 'Final standings' })).toBeVisible()
  await expectRows(page, 'history', 1)
  await page.reload()
  await expect(page.getByRole('list', { name: 'Final standings' })).toBeVisible()
  expect(await readTable(page, 'history')).toMatchObject([{ gameId: 'bazaar', won: true }])
})
