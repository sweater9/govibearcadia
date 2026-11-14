import { expect, test } from '@playwright/test'
import { expectRows, readTable } from './helpers'

const open = async (page: import('@playwright/test').Page) => {
  await page.clock.install() // fake timers, so runFor drives the game loop
  await page.goto('/play/lane-hopper?seed=e2e-hopper')
  await expect(page.locator('.hp-field')).toBeVisible()
}

test('keys and the pad hop the frog', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.hp-field')).toHaveAttribute('data-col', '3')
  await page.keyboard.press('ArrowLeft')
  await expect(page.locator('.hp-field')).toHaveAttribute('data-col', '2')
  await page.getByRole('button', { name: 'Hop right' }).click()
  await page.getByRole('button', { name: 'Hop right' }).click()
  await expect(page.locator('.hp-field')).toHaveAttribute('data-col', '4')
  await page.keyboard.press('ArrowUp')
  await expect(page.locator('.hp-field')).toHaveAttribute('data-row', '1')
})

test('standing still gets you caught; the run is saved once and Play again starts clean', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Start' }).click()
  await page.keyboard.press('ArrowUp')
  for (let i = 0; i < 12 && !(await page.locator('.hp-over strong').count() && await page.getByRole('button', { name: 'Play again' }).count()); i++) await page.clock.runFor(1000)
  await expect(page.getByRole('button', { name: 'Play again' })).toBeVisible()
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'lane-hopper', won: false })
  expect(Number(row.score)).toBe(1)

  await page.clock.runFor(10_000)
  await expectRows(page, 'history', 1)
  await page.getByRole('button', { name: 'Play again' }).click()
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
  await expectRows(page, 'history', 1)
})
