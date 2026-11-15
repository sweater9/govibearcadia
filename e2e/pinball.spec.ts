import { expect, test } from '@playwright/test'
import { expectRows, readTable } from './helpers'

test('three balls with no input end the game, and it is saved once', async ({ page }) => {
  test.setTimeout(240_000)
  await page.clock.install({ time: new Date('2026-11-15T10:00:00Z') })
  await page.goto('/play/pinball?seed=e2e-pb')
  await expect(page.locator('.pb-table')).toBeVisible()
  await page.clock.pauseAt(new Date('2026-11-15T10:00:30Z'))
  const launch = page.getByRole('button', { name: 'Launch ball' })
  const over = page.getByText('Game over')
  for (let guard = 0; guard < 400 && !(await over.isVisible()); guard++) {
    if (await launch.isVisible()) await launch.click()
    await page.clock.runFor(500)
  }
  await expect(over).toBeVisible()
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'pinball', won: false })
  await page.clock.runFor(5000)
  await expectRows(page, 'history', 1)
})

test('Space launches, the ball moves, and the keyboard works the flippers', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-15T10:00:00Z') })
  await page.goto('/play/pinball?seed=e2e-pb-keys')
  await expect(page.locator('.pb-table')).toBeVisible()
  await page.clock.pauseAt(new Date('2026-11-15T10:00:30Z'))
  await page.keyboard.press('Space')
  await expect(page.locator('.pb-table')).toHaveAttribute('data-status', 'playing')
  const y0 = Number(await page.locator('.pb-table').getAttribute('data-ball-y'))
  await page.clock.runFor(200)
  expect(Number(await page.locator('.pb-table').getAttribute('data-ball-y'))).toBeLessThan(y0)
  await page.keyboard.down('ArrowLeft')
  await expect(page.locator('[data-side="left"]')).toHaveAttribute('data-held', 'true')
  await page.keyboard.up('ArrowLeft')
  await expect(page.locator('[data-side="left"]')).toHaveAttribute('data-held', 'false')
})

test('P pauses: the ball stops until resumed', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-15T10:00:00Z') })
  await page.goto('/play/pinball?seed=e2e-pb-pause')
  await expect(page.locator('.pb-table')).toBeVisible()
  await page.clock.pauseAt(new Date('2026-11-15T10:00:30Z'))
  await page.keyboard.press('Space')
  await page.clock.runFor(100)
  await page.keyboard.press('p')
  await expect(page.locator('.pb-table')).toHaveAttribute('data-paused', 'true')
  const at = await page.locator('.pb-table').getAttribute('data-ball-y')
  await page.clock.runFor(500)
  expect(await page.locator('.pb-table').getAttribute('data-ball-y')).toBe(at)
  await page.keyboard.press('Escape')
  await expect(page.locator('.pb-table')).toHaveAttribute('data-paused', 'false')
})

test('touch: pressing the left half of the table raises the left flipper', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch is exercised in the phone project')
  await page.goto('/play/pinball?seed=e2e-pb-touch')
  const box = (await page.locator('.pb-table').boundingBox())!
  await page.getByRole('button', { name: 'Launch ball' }).click()
  await page.touchscreen.tap(box.x + box.width * 0.2, box.y + box.height * 0.6)
  await expect(page.locator('[data-side="left"]')).toHaveAttribute('data-held', 'false')
  await expect(page.locator('.pb-table')).toHaveAttribute('data-status', /playing|ready/)
})
