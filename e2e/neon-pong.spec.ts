import { expect, test, type Page } from '@playwright/test'
import { expectRows, readTable } from './helpers'

// The loop runs on requestAnimationFrame, which the Playwright clock fakes, so time is fully controlled.

const T0 = new Date('2026-10-28T10:00:00Z')
const num = async (page: Page, selector: string, attr: string) => Number(await page.locator(selector).getAttribute(attr))
const score = (page: Page) => page.locator('.pong-bar strong').getAttribute('aria-label')

async function open(page: Page) {
  await page.clock.install({ time: T0 })
  await page.goto('/play/neon-pong?seed=e2e-pong')
  await expect(page.locator('.pong-field')).toBeVisible()
  await page.clock.pauseAt(new Date(T0.getTime() + 30_000))
}

async function fieldPoint(page: Page, fx: number) {
  const box = (await page.locator('.pong-field').boundingBox())!
  return { x: box.x + box.width * fx, y: box.y + box.height * 0.9 }
}

/** Moves the player's paddle to a fraction across the field with whatever pointer the device has. */
async function moveTo(page: Page, fx: number, isMobile: boolean) {
  const { x, y } = await fieldPoint(page, fx)
  if (isMobile) await page.touchscreen.tap(x, y) // a touch also serves a waiting ball
  else await page.mouse.move(x, y)
}

const readBall = (page: Page) =>
  page.evaluate(() => {
    const n = (s: string, a: string) => Number(document.querySelector(s)!.getAttribute(a))
    return { ballX: n('.pong-ball', 'data-x'), aiX: n('.pong-paddle.ai', 'data-x') }
  })

test('serving sends the ball toward you; Space and the button pause and resume', async ({ page }) => {
  await open(page)
  await page.keyboard.press('Space')
  await page.clock.runFor(400)
  const y1 = await num(page, '.pong-ball', 'data-y')
  expect(y1).toBeGreaterThan(215)

  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByText('Paused')).toBeVisible()
  await page.clock.runFor(2000)
  expect(await num(page, '.pong-ball', 'data-y')).toBe(y1)

  await page.getByRole('button', { name: 'Resume' }).click()
  await page.clock.runFor(100)
  expect(await num(page, '.pong-ball', 'data-y')).not.toBe(y1)
})

test('arrow keys move your paddle while held', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'keyboard input')
  await open(page)
  const x0 = await num(page, '.pong-paddle.you', 'data-x')
  await page.keyboard.down('ArrowRight')
  await page.clock.runFor(400)
  await page.keyboard.up('ArrowRight')
  const x1 = await num(page, '.pong-paddle.you', 'data-x')
  expect(x1).toBeGreaterThan(x0 + 100)
  await page.clock.runFor(400)
  expect(await num(page, '.pong-paddle.you', 'data-x')).toBe(x1)
})

test('the mouse moves your paddle', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'mouse input')
  await open(page)
  const { x, y } = await fieldPoint(page, 0.25)
  await page.mouse.move(x, y)
  const px = await num(page, '.pong-paddle.you', 'data-x')
  expect(px).toBeGreaterThan(70)
  expect(px).toBeLessThan(90)
})

test('a touch tap moves your paddle there and serves', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch input')
  await open(page)
  const { x, y } = await fieldPoint(page, 0.75)
  await page.touchscreen.tap(x, y)
  await page.clock.runFor(300)
  expect(await num(page, '.pong-paddle.you', 'data-x')).toBeGreaterThan(220)
  expect(await num(page, '.pong-ball', 'data-y')).not.toBe(210)
})

test('staying out of the way loses 0-7, saves the run once, and Play again starts clean', async ({ page, isMobile }) => {
  await open(page)
  for (let point = 1; point <= 7; point++) {
    await moveTo(page, 0.5, !!isMobile)
    if (!isMobile) await page.keyboard.press('Space')
    for (let i = 0; i < 300 && (await score(page)) !== `You 0, computer ${point}`; i++) {
      const { ballX } = await readBall(page)
      await moveTo(page, ballX < 160 ? 0.97 : 0.03, !!isMobile)
      await page.clock.runFor(200)
    }
    expect(await score(page)).toBe(`You 0, computer ${point}`)
  }
  await expect(page.getByRole('heading', { name: 'CPU wins' })).toBeVisible()
  await expectRows(page, 'history', 1)
  expect((await readTable(page, 'history'))[0]).toMatchObject({ gameId: 'neon-pong', score: 0, won: false })

  await page.clock.runFor(10_000)
  await expectRows(page, 'history', 1)
  await page.getByRole('button', { name: 'Play again' }).click()
  expect(await score(page)).toBe('You 0, computer 0')
  await expectRows(page, 'history', 1)
})

test('a player who tracks the ball and aims away from the computer scores against it', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'the tracking bot uses the mouse')
  test.setTimeout(120_000)
  await open(page)
  let scored = false
  for (let i = 0; i < 900 && !scored; i++) {
    const state = await page.evaluate(() => {
      const n = (s: string, a: string) => Number(document.querySelector(s)!.getAttribute(a))
      return {
        ballX: n('.pong-ball', 'data-x'),
        aiX: n('.pong-paddle.ai', 'data-x'),
        waiting: !!document.querySelector('.pong-hint'),
        label: document.querySelector('.pong-bar strong')!.getAttribute('aria-label'),
      }
    })
    scored = state.label !== 'You 0, computer 0' && state.label!.startsWith('You 1')
    if (scored) break
    if (state.waiting) await page.keyboard.press('Space')
    // Hit the ball toward the side the computer is not on, with the paddle's edge.
    const away = state.aiX < 160 ? 1 : -1
    const { x, y } = await fieldPoint(page, Math.min(1, Math.max(0, (state.ballX - away * 27) / 320)))
    await page.mouse.move(x, y)
    await page.clock.runFor(60)
  }
  expect(scored).toBe(true)
  await expectRows(page, 'history', 0) // the match is not over, so nothing is saved yet
})
