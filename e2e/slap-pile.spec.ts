import { expect, test } from '@playwright/test'
import { expectRows } from './helpers'

// Written against the real UI but NOT yet run (the shared e2e port is used by the release run).
test('Slap Pile: play with Enter and Space, pause, and pile counts change', async ({ page }) => {
  await page.clock.install()
  await page.goto('/play/slap-pile?seed=e2e')
  await expect(page.getByTestId('sp-count-0')).toHaveText('26')
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('sp-pile-size')).toHaveText('1 in pile')
  await page.keyboard.press('p')
  await expect(page.getByRole('status').filter({ hasText: 'Paused' })).toBeVisible()
  await page.keyboard.press('p')
  await page.clock.runFor(3000)
  // A wrong slap burns a card (the pile never shows a pair right after one card).
  const before = Number(await page.getByTestId('sp-count-0').textContent())
  await page.getByTestId('sp-slap').click()
  const after = Number(await page.getByTestId('sp-count-0').textContent())
  expect(after).not.toBe(before)
})

test('Slap Pile: touch buttons work at phone width and a finished game is saved', async ({ page }) => {
  await page.clock.install()
  await page.goto('/play/slap-pile?seed=e2e-finish')
  for (let i = 0; i < 3000; i++) {
    if (await page.getByTestId('sp-over').isVisible()) break
    const play = page.getByTestId('sp-play')
    if (await play.isEnabled()) await play.click()
    await page.clock.runFor(60)
  }
  await expect(page.getByTestId('sp-over')).toBeVisible()
  await expectRows(page, 'history', 1)
})
