import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { GAMES } from './helpers'

// axe-core is a dev dependency, injected into the page only during tests (the app itself never loads it).
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')

type Violation = { id: string; impact?: string | null; nodes: { html: string }[] }
async function audit(page: Page): Promise<string[]> {
  await page.evaluate(AXE)
  const violations = await page.evaluate(
    () => (window as unknown as { axe: { run: (c: Document, o: object) => Promise<{ violations: Violation[] }> } }).axe
      .run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } })
      .then((r) => r.violations),
  )
  return violations.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes[0].html.slice(0, 120)}`)
}

// Known limits, not hidden: these boards have 24 px or smaller hit areas on small screens because the board geometry is fixed.
// Star Hop has 121 holes on one board; Aadu Puli Attam's points sit close together. Each is listed so a new problem elsewhere still fails.
const KNOWN_SMALL_TARGETS = ['chinese-checkers', 'aadu-puli-attam']

const PAGES = ['/', '/passport', '/online', '/leaderboard', '/about']

test.describe('accessibility', () => {
  for (const path of PAGES) {
    test(`page ${path} has no automatically detectable problems`, async ({ page }) => {
      await page.goto(path)
      await expect(page.locator('main')).toBeVisible()
      expect(await audit(page)).toEqual([])
    })
  }

  test('every game, as first dealt, has no automatically detectable problems', async ({ page }) => {
    test.setTimeout(300_000)
    const problems: string[] = []
    for (const g of GAMES) {
      await page.goto(`/play/${g.id}`)
      await expect(page.locator('main')).toBeVisible()
      await page.waitForLoadState('networkidle')
      for (const v of await audit(page)) {
        if (v.startsWith('target-size') && KNOWN_SMALL_TARGETS.includes(g.id)) continue
        problems.push(`${g.id}: ${v}`)
      }
    }
    expect(problems).toEqual([])
  })

  test('the skip link is the first thing Tab reaches and it moves focus to the page content', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard navigation')
    await page.goto('/passport')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Skip to main content' })
    await expect(skip).toBeFocused()
    await expect(skip).toBeInViewport()
    await page.keyboard.press('Enter')
    await expect(page.locator('main')).toBeFocused()
  })

  test('moving to another page is announced to screen readers', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the main menu is hidden on phones')
    await page.goto('/')
    const status = page.locator('p.sr-only[role="status"]')
    await expect(status).toHaveText('')
    await page.goto('/')
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Passport' }).click()
    await expect(page).toHaveURL(/\/passport/)
    await expect(status).toHaveText(/\S/)
    expect(await status.textContent()).toBe(await page.title())
  })

  test('a board that takes keyboard focus shows a focus ring', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard navigation')
    await page.goto('/play/vibeline')
    const board = page.locator('.vl-board')
    await board.focus()
    await page.keyboard.press('ArrowRight')
    const outline = await board.evaluate((el) => getComputedStyle(el).outlineStyle)
    expect(outline).not.toBe('none')
  })

  test('with reduced motion on, nothing keeps animating on the home page or a game', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await context.newPage()
    for (const path of ['/', '/play/pulse-tap', '/play/neon-snake']) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const running = await page.evaluate(() =>
        document.getAnimations().filter((a) => a.playState === 'running' && (a.effect?.getComputedTiming().iterations === Infinity || Number(a.effect?.getComputedTiming().duration ?? 0) > 400)).length,
      )
      expect(running, path).toBe(0)
    }
    await context.close()
  })
})
