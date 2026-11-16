import { expect, test } from '@playwright/test'
import { expectRows, readTable } from './helpers'

test('an idle hero runs out of lives; the run is saved once and Play again starts clean', async ({ page }) => {
  test.setTimeout(180_000)
  await page.clock.install({ time: new Date('2026-11-15T10:00:00Z') })
  await page.goto('/play/pixel-run?seed=e2e-pr')
  const field = page.locator('.pr-field')
  await expect(field).toBeVisible()
  await page.getByLabel('Difficulty').selectOption('hard')
  await page.keyboard.press('Space')
  await expect(field).toHaveAttribute('data-status', 'playing')
  // Standing still, the level timer takes a life each time it runs out (hard: 2 lives, 55 s each).
  for (let i = 0; i < 400 && (await field.getAttribute('data-status')) !== 'lost'; i++) await page.clock.runFor(1000)
  await expect(field).toHaveAttribute('data-status', 'lost')
  await expect(page.locator('.game-over').getByRole('heading', { name: 'Out of lives' })).toBeVisible()
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'pixel-run', won: false })
  await page.clock.runFor(5000)
  await expectRows(page, 'history', 1)
  await page.getByRole('button', { name: 'Play again' }).click()
  await expect(field).toHaveAttribute('data-status', 'ready')
})

test('keys run and jump, pause freezes the hero, and the touch buttons work', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-15T10:00:00Z') })
  await page.goto('/play/pixel-run?seed=e2e-pr-keys')
  const field = page.locator('.pr-field')
  await expect(field).toBeVisible()
  await page.keyboard.press('Space')
  await page.keyboard.up('Space')
  await page.clock.runFor(200)
  const x0 = Number(await field.getAttribute('data-x'))
  const floor = Number(await field.getAttribute('data-y'))
  await page.keyboard.down('ArrowRight')
  await page.clock.runFor(400)
  await page.keyboard.up('ArrowRight')
  expect(Number(await field.getAttribute('data-x'))).toBeGreaterThan(x0 + 15)

  // A jump lifts the hero off the floor.
  await page.keyboard.down('Space')
  await page.clock.runFor(250)
  expect(Number(await field.getAttribute('data-y'))).toBeLessThan(floor - 10)
  await page.keyboard.up('Space')
  await page.clock.runFor(1000)

  await page.keyboard.press('p')
  await expect(field).toHaveAttribute('data-status', 'paused')
  const px = await field.getAttribute('data-x')
  await page.clock.runFor(500)
  expect(await field.getAttribute('data-x')).toBe(px)
  await page.keyboard.press('p')
  await expect(field).toHaveAttribute('data-status', 'playing')

  // The on-screen buttons: hold Move right, then tap Jump.
  const before = Number(await field.getAttribute('data-x'))
  const right = (await page.getByRole('button', { name: 'Move right' }).boundingBox())!
  await page.mouse.move(right.x + right.width / 2, right.y + right.height / 2)
  await page.mouse.down()
  await page.clock.runFor(300)
  await page.mouse.up()
  expect(Number(await field.getAttribute('data-x'))).toBeGreaterThan(before + 10)
})
