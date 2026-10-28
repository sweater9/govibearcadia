import { expect, test, type Page } from '@playwright/test'
import { expectRows, readTable } from './helpers'

// The loop runs on requestAnimationFrame, which the Playwright clock fakes, so time is fully controlled.

const T0 = new Date('2026-10-28T10:00:00Z')
const num = async (page: Page, selector: string, attr: string) => Number(await page.locator(selector).getAttribute(attr))

async function open(page: Page) {
  await page.clock.install({ time: T0 })
  await page.goto('/play/brick-breaker?seed=e2e-brk')
  await expect(page.locator('.brk-field')).toBeVisible()
  await page.clock.pauseAt(new Date(T0.getTime() + 30_000))
}

/** Screen position of a point on the field, as a fraction (0..1) across it. */
async function fieldPoint(page: Page, fx: number, fy = 0.9) {
  const box = (await page.locator('.brk-field').boundingBox())!
  return { x: box.x + box.width * fx, y: box.y + box.height * fy }
}

/** Moves the paddle to a fraction across the field with whatever pointer the device has (a touch move also serves a waiting ball). */
async function moveTo(page: Page, fx: number, isMobile: boolean) {
  const { x, y } = await fieldPoint(page, fx)
  if (isMobile) await page.touchscreen.tap(x, y)
  else await page.mouse.move(x, y)
}

/** Serves, then keeps the paddle on the far side from the ball until a life is lost. */
async function loseALife(page: Page, isMobile: boolean, livesAfter: number) {
  await moveTo(page, 0.5, isMobile)
  if (!isMobile) await page.keyboard.press('Space')
  for (let i = 0; i < 400; i++) {
    if (await page.getByLabel(`${livesAfter} lives`).count()) return
    const ballX = await num(page, '.brk-ball', 'data-x')
    await moveTo(page, ballX < 160 ? 0.97 : 0.03, isMobile)
    await page.clock.runFor(250)
  }
  throw new Error(`never reached ${livesAfter} lives`)
}

test('serving sends the ball up; Space and the button pause and resume', async ({ page }) => {
  await open(page)
  const y0 = await num(page, '.brk-ball', 'data-y')
  await page.keyboard.press('Space')
  await page.clock.runFor(500)
  const y1 = await num(page, '.brk-ball', 'data-y')
  expect(y1).toBeLessThan(y0 - 40)

  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByText('Paused')).toBeVisible()
  await page.clock.runFor(2000)
  expect(await num(page, '.brk-ball', 'data-y')).toBe(y1)

  await page.getByRole('button', { name: 'Resume' }).click()
  await page.clock.runFor(200)
  expect(await num(page, '.brk-ball', 'data-y')).not.toBe(y1)
})

test('arrow keys move the paddle while held', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'keyboard input')
  await open(page)
  const x0 = await num(page, '.brk-paddle', 'data-x')
  await page.keyboard.down('ArrowRight')
  await page.clock.runFor(400)
  await page.keyboard.up('ArrowRight')
  const x1 = await num(page, '.brk-paddle', 'data-x')
  expect(x1).toBeGreaterThan(x0 + 100)
  await page.clock.runFor(400)
  expect(await num(page, '.brk-paddle', 'data-x')).toBe(x1)
})

test('the mouse moves the paddle', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'mouse input')
  await open(page)
  const { x, y } = await fieldPoint(page, 0.25)
  await page.mouse.move(x, y)
  const px = await num(page, '.brk-paddle', 'data-x')
  expect(px).toBeGreaterThan(70)
  expect(px).toBeLessThan(90) // a quarter of a 320-wide field is 80
})

test('a touch tap moves the paddle there and serves', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch input')
  await open(page)
  const { x, y } = await fieldPoint(page, 0.75)
  const y0 = await num(page, '.brk-ball', 'data-y')
  await page.touchscreen.tap(x, y)
  await page.clock.runFor(300)
  expect(await num(page, '.brk-paddle', 'data-x')).toBeGreaterThan(220)
  expect(await num(page, '.brk-ball', 'data-y')).toBeLessThan(y0)
})

test('missing the ball three times ends the game and saves it once', async ({ page, isMobile }) => {
  await open(page)
  await loseALife(page, !!isMobile, 2)
  await loseALife(page, !!isMobile, 1)
  await loseALife(page, !!isMobile, 0)
  await expect(page.getByRole('heading', { name: 'Game over' })).toBeVisible()

  const score = Number(await page.getByText('Score', { exact: true }).locator('xpath=following-sibling::strong').textContent())
  await expectRows(page, 'history', 1)
  expect((await readTable(page, 'history'))[0]).toMatchObject({ gameId: 'brick-breaker', score, won: false })

  await page.clock.runFor(10_000)
  await expectRows(page, 'history', 1)
  await page.getByRole('button', { name: 'Play again' }).click()
  await expect(page.getByLabel('3 lives')).toBeVisible()
  await expectRows(page, 'history', 1)
})
