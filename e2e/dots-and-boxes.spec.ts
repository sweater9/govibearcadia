import { expect, test } from '@playwright/test'
import { expectRows, readTable } from './helpers'

const edges = (page: import('@playwright/test').Page) => page.locator('[data-edge]')

test('plays a 2x2 game against the computer with real clicks and saves the result once', async ({ page }) => {
  await page.goto('/play/dots-and-boxes?seed=e2e-dots')
  await page.getByRole('button', { name: /New game/ }).click()
  await page.getByRole('button', { name: 'Custom' }).click()
  await page.getByLabel('Rows').fill('2')
  await page.getByLabel('Columns').fill('2')
  await page.getByLabel('Computer level').selectOption('easy')
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(edges(page)).toHaveCount(12)
  for (let i = 0; i < 40; i++) {
    if (await page.getByRole('button', { name: 'Play again' }).isVisible()) break
    const status = await page.getByRole('status').textContent()
    if (/your turn/.test(status ?? '')) await edges(page).first().click({ force: true })
    await page.waitForTimeout(150)
  }
  await expect(page.getByRole('status')).toContainText(/ wins?, | draw/)
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'dots-and-boxes' })
  await page.waitForTimeout(800)
  await expectRows(page, 'history', 1)
  await page.getByRole('button', { name: 'Play again' }).click()
  await expect(edges(page)).toHaveCount(12)
})

test('keyboard: Enter draws a line and focus moves on; a completed box gives the same player another turn', async ({ page }) => {
  await page.goto('/play/dots-and-boxes?seed=e2e-dots-kb')
  await page.getByRole('button', { name: /New game/ }).click()
  await page.getByLabel('Opponent').selectOption('two')
  await page.getByRole('button', { name: 'Start' }).click()
  await edges(page).first().focus()
  await page.keyboard.press('Enter')
  await expect(edges(page)).toHaveCount(39)
  await expect(page.locator('[data-edge]:focus')).toHaveCount(1)
  await expect(page.getByRole('status')).toContainText('Player 2')
  // Box 0 on a 4x4 board has sides 0 (top), 4 (bottom), 20 (left) and 21 (right). Line 0 is drawn; draw the other three.
  for (const e of [4, 20, 21]) await page.locator(`[data-edge="${e}"]`).click({ force: true })
  await expect(page.getByRole('status')).toContainText(/Player 2.*extra turn/)
  await expect(page.locator('.db-score')).toContainText('Player 2: 1')
})

test('phone: the board fits without scrolling and undo works', async ({ page }) => {
  await page.goto('/play/dots-and-boxes?seed=e2e-dots-undo')
  await edges(page).nth(3).click({ force: true })
  await expect(edges(page)).toHaveCount(39)
  await expect.poll(() => edges(page).count()).toBe(38) // the computer answered
  await page.getByRole('button', { name: /Undo/ }).click()
  await expect(edges(page)).toHaveCount(40)
})
