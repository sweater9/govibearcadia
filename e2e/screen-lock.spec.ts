import { expect, test } from '@playwright/test'

test('on a phone, Fit to screen locks the page to the game and Unlock restores it', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the lock button is for phones')
  await page.goto('/play/connect-four')
  await expect(page.locator('.nav')).toBeVisible()
  await page.getByRole('button', { name: 'Fit to screen and lock' }).click()
  await expect(page.getByRole('button', { name: 'Unlock screen' })).toBeVisible()
  await expect(page.locator('.nav')).toBeHidden()
  const box = await page.locator('.c4-board').boundingBox()
  const vp = page.viewportSize()!
  expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height)
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true)
  await page.getByRole('button', { name: 'Drop in column 4' }).click()
  await expect(page.locator('.c4-cell[data-p="1"]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Unlock screen' }).click()
  await expect(page.locator('.nav')).toBeVisible()
})

test('on a desktop the lock button is not offered', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop only')
  await page.goto('/play/connect-four')
  await expect(page.getByRole('button', { name: 'Fit to screen and lock' })).toBeHidden()
})
