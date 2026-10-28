import { expect, test } from '@playwright/test'
import { expectRows, hitTarget } from './helpers'

test('favorites survive a reload', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add Pulse Tap to favorites' }).click()
  await expect(page.getByRole('button', { name: 'Remove Pulse Tap from favorites' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('button', { name: 'Remove Pulse Tap from favorites' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add Neon Merge to favorites' })).toBeVisible()

  await page.getByRole('button', { name: 'Remove Pulse Tap from favorites' }).click()
  // The label flips only after the IndexedDB write has committed; reloading earlier would abort it.
  await expect(page.getByRole('button', { name: 'Add Pulse Tap to favorites' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Add Pulse Tap to favorites' })).toBeVisible()
})

test('favoriting from the play page is reflected on the home page', async ({ page }) => {
  await page.goto('/play/memory-grid')
  await page.getByRole('button', { name: 'Toggle favorite' }).click()
  await expectRows(page, 'favorites', 1)

  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Remove Memory Grid from favorites' })).toBeVisible()
})

test('a played game appears under "Continue your run" after a reload', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await expect(page.getByText('Continue your run')).toHaveCount(0)

  await page.goto('/play/pulse-tap')
  await page.getByRole('button', { name: 'Start run' }).click()
  await hitTarget(page)
  await page.clock.runFor(30_000)
  await expectRows(page, 'history', 1)

  await page.goto('/')
  await expect(page.getByText('Continue your run')).toBeVisible()
  await expect(page.locator('.continue h2')).toHaveText('Pulse Tap')
  await expect(page.locator('.continue')).toContainText('1 plays · Best 100')
  await expect(page.getByRole('link', { name: /Continue playing/ })).toHaveAttribute('href', '/play/pulse-tap')
})
