import { expect, test } from '@playwright/test'

test('supports local play, keyboard input, and restores an unfinished match', async ({ page }) => {
  await page.goto('/play/aadu-puli-attam')
  await expect(page.locator('.ap-board')).toBeVisible()
  await expect(page.locator('.ap-point')).toHaveCount(23)
  await page.getByLabel('Mode').selectOption('local')
  const point = page.getByRole('button', { name: 'Empty point 2', exact: true })
  await point.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Goat at point 2', exact: true })).toBeVisible()
  await expect(page.locator('.ap-status')).toHaveText('Tigers to play')
  await page.reload()
  await expect(page.getByLabel('Mode')).toHaveValue('local')
  await expect(page.getByRole('button', { name: 'Goat at point 2', exact: true })).toBeVisible()
})

test('computer responds offline and undo returns both turns', async ({ page }) => {
  await page.clock.install()
  await page.goto('/play/aadu-puli-attam?seed=e2e-aadu')
  await page.getByRole('button', { name: 'Empty point 2', exact: true }).click()
  await page.clock.runFor(420)
  await expect(page.locator('.ap-status')).toHaveText('Your turn')
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.locator('.ap-options')).toContainText('Captured 0/5')
  await expect(page.getByRole('button', { name: 'Empty point 2', exact: true })).toBeVisible()
})
