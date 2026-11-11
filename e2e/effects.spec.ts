import { expect, test } from '@playwright/test'

test('a rising score pops a +N that clears itself', async ({ page }) => {
  await page.goto('/play/neon-merge')
  const keys = ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp']
  let seen = false
  for (let i = 0; i < 80 && !seen; i++) {
    await page.keyboard.press(keys[i % 4])
    seen = (await page.locator('.fx-pop').count()) > 0
  }
  expect(seen).toBe(true)
  await expect(page.locator('.fx-pop')).toHaveCount(0, { timeout: 3000 })
})

test('reduced motion turns the effects off', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/play/neon-merge')
  const keys = ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp']
  for (let i = 0; i < 40; i++) await page.keyboard.press(keys[i % 4])
  await expect(page.locator('.fx-pop')).toHaveCount(0)
})
