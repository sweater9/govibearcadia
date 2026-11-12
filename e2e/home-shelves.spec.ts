import { expect, test } from '@playwright/test'
import { overflowsHorizontally } from './helpers'

test('the home page promises no ads and offers themed shelves of games that open', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The arcade with no ads.')
  const promise = page.getByRole('list', { name: 'What you get' })
  for (const t of ['No ads', 'No sign-up', 'Works offline', 'Yours to keep']) await expect(promise).toContainText(t)
  for (const t of ['5-minute fun', 'Train your brain', 'With friends', 'Cards and table games', 'Timeless classics', 'Arcade rush']) {
    await expect(page.getByRole('region', { name: t })).toBeVisible()
  }
  await expect(page.getByRole('region', { name: 'Recently played' })).toHaveCount(0) // nothing played yet
  const poker = page.getByRole('region', { name: 'Cards and table games' }).getByRole('link', { name: /Poker/ })
  await expect(poker).toHaveAttribute('href', '/play/poker')
  await poker.click()
  await expect(page).toHaveURL(/\/play\/poker$/)
})

test('a game you played shows up under Recently played', async ({ page }) => {
  await page.goto('/play/blackjack?seed=e2e-recent')
  await page.getByRole('button', { name: 'Start session' }).click()
  await page.getByRole('button', { name: 'Cash out' }).click()
  await expect(page.locator('.bj-status')).toContainText('Cashed out')
  await page.goto('/')
  const recent = page.getByRole('region', { name: 'Recently played' })
  await expect(recent.getByRole('link', { name: /Blackjack/ })).toBeVisible()
})

test('the shelves and the comparison fit the screen without sideways scrolling', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'How GoVibeArcadia differs' })).toBeVisible()
  expect(await overflowsHorizontally(page)).toBe(false)
})
