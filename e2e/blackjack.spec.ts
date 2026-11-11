import { expect, test } from '@playwright/test'
import { applyAction, newGame } from '../src/games/blackjack/rules'
import { expectRows, overflowsHorizontally, readTable } from './helpers'

test('the seeded deal is the one the rules produce, and standing settles exactly as the rules say', async ({ page }) => {
  const seed = 'e2e-bj'
  const dealt = applyAction(newGame(seed), { type: 'bet', amount: 50 })
  const final = dealt.phase === 'play' ? applyAction(dealt, { type: 'stand' }) : dealt
  await page.goto(`/play/blackjack?seed=${seed}`)
  await page.getByRole('button', { name: 'Start session' }).click()
  await page.getByRole('button', { name: 'Deal' }).click()
  await expect(page.locator('.bj-seat[aria-label="Your hands"] .bj-card')).toHaveCount(2)
  if (dealt.phase === 'play') await page.getByRole('button', { name: 'Stand' }).click()
  await expect(page.locator('.bj-stats b').first()).toHaveText(String(final.chips))
  expect(await overflowsHorizontally(page)).toBe(false)
})

test('keys play a hand and cashing out saves the session once', async ({ page }) => {
  await page.goto('/play/blackjack?seed=e2e-bj-keys')
  await page.getByRole('button', { name: 'Start session' }).click()
  await page.getByRole('button', { name: 'Deal' }).click()
  if (await page.getByRole('button', { name: 'Stand' }).isVisible()) await page.keyboard.press('s')
  await expect(page.getByRole('button', { name: 'Cash out' })).toBeVisible()
  await page.getByRole('button', { name: 'Cash out' }).click()
  await expect(page.locator('.bj-status')).toContainText('Cashed out')
  await expectRows(page, 'history', 1)
  expect((await readTable(page, 'history'))[0]).toMatchObject({ gameId: 'blackjack' })
})
