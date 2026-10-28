import { expect, test, type Page } from '@playwright/test'
import { expectRows, readTable } from './helpers'

// The loop runs on requestAnimationFrame, which the Playwright clock fakes, so time is fully controlled.

const T0 = new Date('2026-10-28T10:00:00Z')
const num = async (page: Page, selector: string, attr: string) => Number(await page.locator(selector).getAttribute(attr))
const enemies = (page: Page) => page.locator('.sd-enemy').count()

async function open(page: Page) {
  await page.clock.install({ time: T0 })
  await page.goto('/play/space-defender?seed=e2e-sd')
  await expect(page.locator('.sd-field')).toBeVisible()
  await page.clock.pauseAt(new Date(T0.getTime() + 30_000))
}

async function fieldPoint(page: Page, fx: number) {
  const box = (await page.locator('.sd-field').boundingBox())!
  return { x: box.x + box.width * fx, y: box.y + box.height * 0.9 }
}

test('starts with 24 invaders; Space starts the fight and the ship fires by itself', async ({ page }) => {
  await open(page)
  expect(await enemies(page)).toBe(24)
  await expect(page.locator('.sd-bullet')).toHaveCount(0)
  await page.keyboard.press('Space')
  await page.clock.runFor(200)
  expect(await page.locator('.sd-bullet').count()).toBeGreaterThanOrEqual(1)
})

test('the ship, sitting under the formation, shoots invaders down and scores', async ({ page }) => {
  await open(page)
  await page.keyboard.press('Space')
  await page.clock.runFor(8000)
  expect(await enemies(page)).toBeLessThan(24)
  const score = Number(await page.getByText('Score', { exact: true }).locator('xpath=following-sibling::strong').textContent())
  expect(score).toBeGreaterThan(0)
  await expectRows(page, 'history', 0)
})

test('Space and the button pause and resume', async ({ page }) => {
  await open(page)
  await page.keyboard.press('Space')
  await page.clock.runFor(300)
  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByText('Paused')).toBeVisible()
  const before = await page.locator('.sd-enemy').first().getAttribute('style')
  await page.clock.runFor(2000)
  expect(await page.locator('.sd-enemy').first().getAttribute('style')).toBe(before)
  await page.getByRole('button', { name: 'Resume' }).click()
  await page.clock.runFor(300)
  expect(await page.locator('.sd-enemy').first().getAttribute('style')).not.toBe(before)
})

test('arrow keys move the ship while held', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'keyboard input')
  await open(page)
  const x0 = await num(page, '.sd-ship', 'data-x')
  await page.keyboard.down('ArrowRight')
  await page.clock.runFor(400)
  await page.keyboard.up('ArrowRight')
  const x1 = await num(page, '.sd-ship', 'data-x')
  expect(x1).toBeGreaterThan(x0 + 60)
  await page.clock.runFor(400)
  expect(await num(page, '.sd-ship', 'data-x')).toBe(x1)
})

test('the mouse moves the ship', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'mouse input')
  await open(page)
  const { x, y } = await fieldPoint(page, 0.25)
  await page.mouse.move(x, y)
  const sx = await num(page, '.sd-ship', 'data-x')
  expect(sx).toBeGreaterThan(70)
  expect(sx).toBeLessThan(90)
})

test('a touch tap moves the ship there and starts the fight', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch input')
  await open(page)
  const { x, y } = await fieldPoint(page, 0.75)
  await page.touchscreen.tap(x, y)
  await page.clock.runFor(300)
  expect(await num(page, '.sd-ship', 'data-x')).toBeGreaterThan(220)
  expect(await page.locator('.sd-bullet').count()).toBeGreaterThanOrEqual(1)
})

test('an unattended ship is overrun; the run is saved once and Play again starts clean', async ({ page, isMobile }) => {
  await open(page)
  if (isMobile) {
    const { x, y } = await fieldPoint(page, 0.97)
    await page.touchscreen.tap(x, y)
  } else {
    const { x, y } = await fieldPoint(page, 0.97)
    await page.mouse.move(x, y)
    await page.keyboard.press('Space')
  }
  for (let i = 0; i < 40 && !(await page.getByRole('heading', { name: 'Overrun' }).count()); i++) await page.clock.runFor(5000)
  await expect(page.getByRole('heading', { name: 'Overrun' })).toBeVisible()

  const score = Number(await page.getByText('Score', { exact: true }).locator('xpath=following-sibling::strong').textContent())
  await expectRows(page, 'history', 1)
  expect((await readTable(page, 'history'))[0]).toMatchObject({ gameId: 'space-defender', score, won: false })

  await page.clock.runFor(10_000)
  await expectRows(page, 'history', 1)
  await page.getByRole('button', { name: 'Play again' }).click()
  await expect(page.getByLabel('3 lives')).toBeVisible()
  expect(await enemies(page)).toBe(24)
  await expectRows(page, 'history', 1)
})
