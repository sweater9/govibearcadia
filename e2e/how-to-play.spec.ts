import { expect, test } from '@playwright/test'

test('How to play opens the rules, closes with Escape, and the new marker goes away', async ({ page }) => {
  await page.goto('/play/hangman')
  const button = page.getByRole('button', { name: 'How to play (new)' })
  await expect(button).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0) // never opens by itself
  await button.click()
  const dialog = page.getByRole('dialog', { name: 'How to play Hangman' })
  await expect(dialog).toContainText('Controls')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: 'How to play', exact: true })).toBeVisible()
})

test('the dialog fits a phone screen and Got it closes it', async ({ page }) => {
  await page.goto('/play/maze-runner')
  await page.getByRole('button', { name: /How to play/ }).click()
  const box = await page.getByRole('dialog').boundingBox()
  const vp = page.viewportSize()!
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width)
  expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height)
  await page.getByRole('button', { name: 'Got it' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
