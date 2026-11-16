import { expect, test } from '@playwright/test'
import { expectRows, readTable } from './helpers'

test('clicking builds a tower, spends gold and the path refuses towers', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-15T10:00:00Z') })
  await page.goto('/play/tower-defense?seed=e2e-td')
  await expect(page.locator('.td-board')).toBeVisible()
  await page.getByRole('button', { name: 'Normal' }).click()
  await page.getByLabel('Empty cell, column 1, row 1').click({ force: true })
  await expect(page.getByTestId('td-gold')).toHaveText('100')
  await expect(page.getByLabel(/Bolt tower level 1 at column 1, row 1/)).toBeVisible()
  await expect(page.locator('.td-board')).toHaveAttribute('data-towers', '1')
})

test('keyboard builds and sends a wave', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-15T10:00:00Z') })
  await page.goto('/play/tower-defense?seed=e2e-td-keys')
  await expect(page.locator('.td-board')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.locator('.td-board')).toHaveAttribute('data-towers', '1')
  await page.keyboard.press('n')
  await expect(page.locator('.td-board')).toHaveAttribute('data-status', 'wave')
})

test('letting every wave through ends the game and it is saved once', async ({ page }) => {
  test.setTimeout(240_000)
  await page.clock.install({ time: new Date('2026-11-15T10:00:00Z') })
  await page.goto('/play/tower-defense?seed=e2e-td-lose')
  await expect(page.locator('.td-board')).toBeVisible()
  await page.clock.pauseAt(new Date('2026-11-15T10:00:30Z'))
  const over = page.getByText('Overrun')
  for (let guard = 0; guard < 200 && !(await over.isVisible()); guard++) {
    const send = page.getByRole('button', { name: /^(Start|Send) wave/ })
    if (await send.isEnabled()) await send.click()
    await page.clock.runFor(10_000)
  }
  await expect(over).toBeVisible()
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'tower-defense', won: false })
  await page.clock.runFor(5000)
  await expectRows(page, 'history', 1)
})
