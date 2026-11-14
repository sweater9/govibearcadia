import { expect, test } from '@playwright/test'
import { expectRows, readTable } from './helpers'

test('perfect drops score, a sloppy tower falls, and the run is saved once', async ({ page }) => {
  await page.clock.install() // fake timers, so runFor drives the game loop
  await page.goto('/play/stack-tower?seed=e2e-stack')
  await expect(page.locator('.stk-field')).toBeVisible()
  await page.getByRole('button', { name: 'Start' }).click()

  const topLeft = async () => parseFloat(/left:\s*([\d.]+)%/.exec((await page.locator('.stk-block:not(.stk-cur)').last().getAttribute('style')) ?? '')![1])
  const curX = async () => Number(await page.locator('.stk-cur').getAttribute('data-x'))

  // Five perfect drops: step the clock until the sliding block is lined up, then press space.
  for (let n = 1; n <= 5; n++) {
    const target = await topLeft()
    for (let i = 0; i < 400 && Math.abs((await curX()) - target) > 0.9; i++) await page.clock.runFor(8)
    await page.keyboard.press('Space')
    await expect(page.locator('.stk-field')).toHaveAttribute('data-floors', String(n))
  }
  await expect(page.getByText('Perfect!')).toBeVisible()

  // Now drop carelessly until the tower falls.
  for (let i = 0; i < 80 && !(await page.getByText('Tower fell!').count()); i++) {
    await page.clock.runFor(137)
    await page.keyboard.press('Space')
  }
  await expect(page.getByText('Tower fell!')).toBeVisible()
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'stack-tower', won: false })
  expect(Number(row.score)).toBeGreaterThanOrEqual(75) // five floors and five perfects

  await page.clock.runFor(5000)
  await expectRows(page, 'history', 1)
  await page.getByRole('button', { name: 'Play again' }).click()
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
  await expectRows(page, 'history', 1)
})

test('the on-screen Drop button works on touch', async ({ page }) => {
  await page.clock.install()
  await page.goto('/play/stack-tower?seed=e2e-stack')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.getByRole('button', { name: 'Drop block' }).click()
  await expect(page.locator('.stk-field')).toHaveAttribute('data-floors', /^[1-9]/)
})
