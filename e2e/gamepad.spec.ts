import { expect, test, type Page } from '@playwright/test'

// A simulated controller: the page's navigator.getGamepads() returns one pad whose buttons the test presses.
// This proves our mapping and focus handling; it cannot prove a real controller or a TV browser.
const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 }

async function withPad(page: Page, url: string) {
  await page.addInitScript(() => {
    const w = window as unknown as { __pad: unknown }
    const pad = { id: 'Test pad', index: 0, connected: true, mapping: 'standard', axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) }
    w.__pad = pad
    navigator.getGamepads = () => [pad as unknown as Gamepad]
  })
  await page.goto(url)
  await page.evaluate(() => window.dispatchEvent(new Event('gamepadconnected')))
}

async function tap(page: Page, button: number) {
  await page.evaluate(async (b) => {
    const pad = (window as unknown as { __pad: { buttons: { pressed: boolean }[] } }).__pad
    const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)))
    pad.buttons[b].pressed = true
    await frame()
    await frame()
    pad.buttons[b].pressed = false
    await frame()
    await frame()
  }, button)
}

const focusedName = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('aria-label') ?? document.activeElement?.textContent?.trim().slice(0, 40) ?? '')

test('the D-pad moves a visible focus ring around the home page, and A opens the focused card', async ({ page }) => {
  await withPad(page, '/')
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true)
  await tap(page, BTN.DOWN)
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false)
  await expect(page.locator('html')).toHaveAttribute('data-input', 'pad')
  const first = await focusedName(page)
  await tap(page, BTN.RIGHT)
  await tap(page, BTN.DOWN)
  expect(await focusedName(page)).not.toBe('')
  expect(typeof first).toBe('string')
  // Move until a game link has focus, then A opens it.
  for (let i = 0; i < 40; i++) {
    if (await page.evaluate(() => (document.activeElement as HTMLAnchorElement | null)?.getAttribute('href')?.startsWith('/play/') ?? false)) break
    await tap(page, BTN.DOWN)
  }
  await tap(page, BTN.A)
  await expect(page).toHaveURL(/\/play\//)
})

test('arrow presses reach a game that uses them and the focus stays put', async ({ page }) => {
  await withPad(page, '/about')
  await page.evaluate(() => {
    const w = window as unknown as { __keys: string[] }
    w.__keys = []
    window.addEventListener('keydown', (e) => {
      w.__keys.push(e.key)
      if (e.key === 'ArrowRight') e.preventDefault() // this "game" uses the right arrow
    })
  })
  await tap(page, BTN.RIGHT)
  expect(await page.evaluate(() => (window as unknown as { __keys: string[] }).__keys)).toContain('ArrowRight')
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true) // claimed, so no focus move
  await tap(page, BTN.A)
  await tap(page, BTN.START)
  const keys = await page.evaluate(() => (window as unknown as { __keys: string[] }).__keys)
  expect(keys).toEqual(expect.arrayContaining([' ', 'p']))
})

test('B goes back on an ordinary page', async ({ page }) => {
  await withPad(page, '/')
  await page.getByRole('link', { name: 'About and privacy' }).click()
  await expect(page).toHaveURL(/\/about/)
  await tap(page, BTN.B)
  await expect(page).toHaveURL(/\/$/)
})

test('Connect Four can be played with the controller alone', async ({ page }) => {
  await withPad(page, '/play/connect-four?seed=pad')
  await tap(page, BTN.DOWN) // nothing focused yet: focus lands near the middle of the screen, on the board
  const col = page.getByRole('button', { name: /Drop in column/ })
  await expect.poll(async () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('aria-label') ?? '')).toMatch(/Drop in column/)
  const before = await col.count()
  expect(before).toBe(7)
  await tap(page, BTN.LEFT)
  await tap(page, BTN.A) // drops a disc in the focused column
  await expect(page.locator('.c4-cell:not([data-p="0"])').first()).toBeVisible()
})

test('a dropdown changes value with the stick instead of trapping the controller', async ({ page }) => {
  await withPad(page, '/online')
  const sel = page.getByLabel('Game')
  await sel.focus()
  const before = await sel.inputValue()
  await tap(page, BTN.DOWN)
  expect(await sel.inputValue()).not.toBe(before)
})

test('without a controller nothing changes', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).not.toHaveAttribute('data-input', 'pad')
})
