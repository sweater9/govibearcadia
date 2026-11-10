import { expect, test } from '@playwright/test'

test('sound is off by default, the choice is remembered, and games still play', async ({ page }) => {
  await page.goto('/play/connect-four')
  const toggle = page.getByRole('button', { name: /Turn sound (on|off)/ })
  await expect(toggle).toHaveAccessibleName('Turn sound on')
  await toggle.click()
  await expect(toggle).toHaveAccessibleName('Turn sound off')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Turn sound off' })).toBeVisible()
  await page.getByRole('button', { name: 'Drop in column 4' }).click()
  await expect(page.locator('.c4-cell[data-p="1"]')).toHaveCount(1)
})
