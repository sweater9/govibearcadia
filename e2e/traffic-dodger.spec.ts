import { expect, test } from '@playwright/test'
import { expectRows, readTable } from './helpers'

const open = async (page: import('@playwright/test').Page) => {
  await page.clock.install() // fake timers, so runFor drives the game loop
  await page.goto('/play/traffic-dodger?seed=e2e-traffic')
  await expect(page.locator('.tr-field')).toBeVisible()
}

test('keys and the on-screen buttons change lane', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.tr-field')).toHaveAttribute('data-lane', '1')
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.tr-field')).toHaveAttribute('data-lane', '2')
  await page.getByRole('button', { name: 'Move left' }).click()
  await page.getByRole('button', { name: 'Move left' }).click()
  await expect(page.locator('.tr-field')).toHaveAttribute('data-lane', '0')
})

test('an unattended car is hit; the run is saved once and Play again starts clean', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Start' }).click()
  for (let i = 0; i < 60 && !(await page.getByText('Crash!').count()); i++) await page.clock.runFor(2000)
  await expect(page.getByText('Crash!')).toBeVisible()
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'traffic-dodger', won: false })
  expect(Number(row.score)).toBeGreaterThan(0)

  await page.clock.runFor(10_000)
  await expectRows(page, 'history', 1)
  await page.getByRole('button', { name: 'Play again' }).click()
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
  await expectRows(page, 'history', 1)
})
