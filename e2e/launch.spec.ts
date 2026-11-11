import { expect, test } from '@playwright/test'

test('an unknown address shows the not-found page, noindex, with a way home', async ({ page }) => {
  await page.goto('/no-such-page')
  await expect(page.getByRole('heading', { name: /not in the arcade/i })).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
  await page.getByRole('link', { name: /back to all games/i }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('the about page is reachable from the footer', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('contentinfo').getByRole('link', { name: /about and privacy/i }).click()
  await expect(page.getByRole('heading', { name: 'About and privacy' })).toBeVisible()
})

test('security headers are sent and the CSP does not break the app', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => { if (/content security policy/i.test(m.text())) errors.push(m.text()) })
  const res = await page.goto('/play/memory-grid')
  const h = res!.headers()
  expect(h['x-content-type-options']).toBe('nosniff')
  expect(h['x-frame-options']).toBe('DENY')
  expect(h['content-security-policy']).toContain("default-src 'self'")
  await page.getByRole('button', { name: /start|play/i }).first().waitFor({ timeout: 5000 }).catch(() => {})
  await page.goto('/play/carrom')
  await page.waitForTimeout(1500)
  expect(errors).toEqual([])
})
