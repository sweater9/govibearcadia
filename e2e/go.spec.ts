import { expect, test, type Page } from '@playwright/test'
import { expectRows, readTable } from './helpers'

const THINK = 450
const pt = (p: Page, i: number) => p.locator(`[data-pt="${i}"]`)
const status = (p: Page) => p.locator('.c4-status')

test('passing at the start ends the game by komi, and the run is saved once', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-15T10:00:00Z') })
  await page.goto('/play/go?seed=e2e-go')
  await expect(page.locator('.go-board')).toBeVisible()
  await page.clock.pauseAt(new Date('2026-11-15T10:00:30Z'))
  await page.getByRole('button', { name: 'Pass' }).click()
  await page.clock.runFor(THINK)
  await expect(page.locator('.game-over').getByRole('heading', { name: 'Computer wins by 6.5' })).toBeVisible()
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'go', won: false })
  await page.clock.runFor(5000)
  await expectRows(page, 'history', 1)
})

test('a click places a black stone, the computer answers, and the keyboard places one too', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-15T10:00:00Z') })
  await page.goto('/play/go?seed=e2e-go-2')
  await expect(pt(page, 40)).toHaveAttribute('aria-label', 'E5, empty')
  await page.clock.pauseAt(new Date('2026-11-15T10:00:30Z'))
  await pt(page, 40).click()
  await expect(pt(page, 40)).toHaveAttribute('data-p', '1')
  await expect(status(page)).toHaveText('Computer is thinking…')
  await page.clock.runFor(THINK)
  await expect(status(page)).toHaveText('Your move (black)')
  expect(await page.locator('[data-p="2"]').count()).toBe(1)
  await pt(page, 20).focus()
  await page.keyboard.press('Enter')
  await expect(pt(page, 20)).toHaveAttribute('data-p', '1')
  // An occupied point cannot be played again.
  await expect(pt(page, 40)).toBeDisabled()
})

test('the 13x13 board has 169 points and still fits the screen', async ({ page }) => {
  await page.goto('/play/go')
  await page.getByLabel('Board size').selectOption('13')
  await expect(page.locator('[data-pt]')).toHaveCount(169)
  const box = await page.locator('.go-board').boundingBox()
  const vh = page.viewportSize()!.height
  expect(box!.y + box!.height).toBeLessThanOrEqual(vh)
})
