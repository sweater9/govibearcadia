import { expect, test, type Page } from '@playwright/test'
import { hitTarget } from './helpers'

/** The element a player actually looks at and interacts with, per game. */
const PLAY_AREA = {
  'neon-merge': '.merge-board',
  'memory-grid': '.memory-grid',
  'pulse-tap': '.pulse-field',
  minesweeper: '.mines-grid',
  'neon-snake': '.snake-board',
  'color-sort': '.csort-tubes',
  'connect-four': '.c4-board',
  'tic-tac-toe': '.ttt-board',
  checkers: '.ck-board',
  'daily-word': '.wordle',
  'brick-breaker': '.brk-field',
  'neon-pong': '.pong-field',
  'sudoku-master': '.sdk',
  'space-defender': '.sd-field',
  'gravity-flip': '.gf',
  vibeline: '.vl',
  twofold: '.tf',
  carve: '.cv',
} as const

type Box = { top: number; bottom: number }

const boxOf = (page: Page, selector: string): Promise<Box> =>
  page.locator(selector).first().evaluate((el) => {
    const r = el.getBoundingClientRect()
    return { top: r.top, bottom: r.bottom }
  })

/** Names of elements that stick out past the left or right edge of the game card. */
const overflowingShell = (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const shell = document.querySelector('.game-shell')!.getBoundingClientRect()
    return Array.from(document.querySelectorAll('.game-shell *'))
      .filter((el) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && (r.right > shell.right + 0.5 || r.left < shell.left - 0.5)
      })
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`)
  })

const navBottom = async (page: Page) => (await boxOf(page, '.nav')).bottom

// A timed game whose targets can spawn below the fold, or under the sticky header, is unplayable.
// The play area must be fully on screen without scrolling at realistic laptop and phone sizes.
test.describe('play area fits on screen', () => {
  const LAPTOPS = [
    { width: 1440, height: 800 },
    { width: 1366, height: 650 },
    { width: 1280, height: 720 },
  ]

  for (const viewport of LAPTOPS) {
    test(`laptop ${viewport.width}x${viewport.height}`, async ({ page, isMobile }) => {
      test.skip(!!isMobile, 'laptop sizes are checked in the desktop project')
      await page.setViewportSize(viewport)
      for (const [id, selector] of Object.entries(PLAY_AREA)) {
        await page.goto(`/play/${id}`)
        await expect(page.locator(selector)).toBeVisible()
        const box = await boxOf(page, selector)
        expect(box.top, `${id} top is below the sticky header`).toBeGreaterThanOrEqual(await navBottom(page))
        expect(box.bottom, `${id} bottom is inside the ${viewport.height}px viewport`).toBeLessThanOrEqual(viewport.height)
      }
    })
  }

  test.describe('small phone 375x667', () => {
    test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true })

    test('every game and the touch pad are fully visible', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'phone', 'covered once, in the phone project')
      for (const [id, selector] of Object.entries(PLAY_AREA)) {
        await page.goto(`/play/${id}`)
        await expect(page.locator(selector)).toBeVisible()
        expect((await boxOf(page, selector)).bottom, `${id} fits`).toBeLessThanOrEqual(667)
        expect(await overflowingShell(page), `${id}: nothing sticks out of the game card`).toEqual([])
      }
      for (const id of ['neon-merge', 'neon-snake']) {
        await page.goto(`/play/${id}`)
        const pad = await boxOf(page, '.dpad')
        expect(pad.bottom, `${id}: on-screen pad is reachable without scrolling`).toBeLessThanOrEqual(667)
      }
    })
  })
})

test('Pulse Tap targets always appear fully on screen on a laptop', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'laptop behaviour')
  await page.clock.install()
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/play/pulse-tap')
  await page.getByRole('button', { name: 'Start run' }).click()

  const nav = await navBottom(page)
  for (let hit = 1; hit <= 40; hit++) {
    const box = await page.getByRole('button', { name: 'Tap target' }).boundingBox()
    expect(box, `target ${hit} exists`).not.toBeNull()
    expect(box!.y, `target ${hit} is not under the header`).toBeGreaterThanOrEqual(nav)
    expect(box!.y + box!.height, `target ${hit} is above the fold`).toBeLessThanOrEqual(720)
    await hitTarget(page)
    await expect(page.locator('.game-toolbar strong').first()).toHaveText(String(hit * 100))
  }
})
