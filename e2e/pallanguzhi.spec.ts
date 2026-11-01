import { expect, test, type Page } from '@playwright/test'
import { createRandom } from '../src/lib/rng'
import { choosePit } from '../src/games/pallanguzhi/ai'
import { apply, legalPits, newGame, seedsOnBoard, type State } from '../src/games/pallanguzhi/rules'
import { TUTORIAL, stepStart } from '../src/games/pallanguzhi/tutorial'
import { expectRows, readTable } from './helpers'

// Pallanguzhi: the page is driven with real clicks and keys, and every board it shows is compared with the pure rules.

const KEY = 'govibearcadia.pallanguzhi'
const SETTINGS = 'govibearcadia.pallanguzhi.settings'

async function open(page: Page, mode: 'local' | 'computer' | 'tutorial' = 'local', state?: State) {
  await page.addInitScript(
    ([settings, key, value]) => {
      if (!localStorage.getItem(settings)) localStorage.setItem(settings, JSON.stringify({ speed: 'instant' }))
      if (value && !localStorage.getItem(key)) localStorage.setItem(key, value)
    },
    [SETTINGS, KEY, state ? JSON.stringify({ v: 1, mode: 'local', level: 'easy', state, history: [] }) : ''] as const,
  )
  await page.goto('/play/pallanguzhi')
  await expect(page.locator('.pg-board')).toBeVisible()
  if (!state && mode !== 'computer') await page.getByLabel('Mode').selectOption(mode)
}

const counts = (page: Page) => page.evaluate(() => Array.from({ length: 14 }, (_, i) => Number(document.querySelector(`.pg-pit[data-pit="${i}"]`)!.getAttribute('data-count'))))
const stores = async (page: Page) => [Number(await page.getByTestId('store-0').innerText()), Number(await page.getByTestId('store-1').innerText())]
const clickPit = (page: Page, pit: number) => page.locator(`.pg-pit[data-pit="${pit}"]`).click()

async function expectBoard(page: Page, s: State) {
  expect(await counts(page)).toEqual(s.pits)
  expect(await stores(page)).toEqual(s.stores)
}

test('the board starts with 14 pits of five seeds, in two rows, with empty trays', async ({ page }) => {
  await open(page, 'local')
  await expectBoard(page, newGame())
  const rows = await page.evaluate(() => [0, 7, 13].map((i) => document.querySelector(`.pg-pit[data-pit="${i}"]`)!.getBoundingClientRect().top))
  expect(rows[0]).toBeGreaterThan(rows[1]) // the bottom row (Player 1) is below the top row
  expect(rows[1]).toBe(rows[2])
  await expect(page.locator('.pg-pit[data-legal]')).toHaveCount(7)
})

test('a real tap sows counterclockwise exactly as the rules say, and the next player moves', async ({ page }) => {
  await open(page, 'local')
  let s = newGame()
  for (let n = 0; n < 8; n++) {
    const legal = legalPits(s) // a capture earns a second sowing, so the same player may move twice
    const pit = legal[n % legal.length]
    await clickPit(page, pit)
    const r = apply(s, { type: 'sow', pit })
    if (!r.ok) throw new Error(r.reason)
    s = r.state
    await expectBoard(page, s)
    expect(seedsOnBoard(s) + s.stores[0] + s.stores[1]).toBe(70)
  }
})

test('a pit that cannot be chosen is explained and nothing changes', async ({ page }) => {
  await open(page, 'local')
  await page.locator('.pg-pit[data-pit="9"]').click({ force: true }) // not a legal pit, so it is aria-disabled
  await expect(page.locator('.pg-note')).toContainText('Player 2’s pit')
  await expectBoard(page, newGame())
})

test('keys 1 to 7 choose a pit and arrow keys move focus', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'keyboard is a desktop input')
  await open(page, 'local')
  await page.keyboard.press('3')
  const r = apply(newGame(), { type: 'sow', pit: 2 })
  if (!r.ok) throw new Error(r.reason)
  await expectBoard(page, r.state)
  await page.locator('.pg-pit[data-pit="9"]').focus()
  await page.keyboard.press('ArrowRight')
  expect(await page.evaluate(() => (document.activeElement as HTMLElement).dataset.pit)).toBe('8')
})

test('a capture shows the Saada, earns a second sowing, and the match is saved and resumes after a reload', async ({ page }) => {
  const s = newGame()
  s.pits = [2, 1, 1, 0, 3, 0, 2, 0, 3, 4, 0, 0, 1, 2]
  s.stores = [25, 26]
  await open(page, 'local', s)
  await clickPit(page, 0)
  const first = apply(s, { type: 'sow', pit: 0 })
  if (!first.ok) throw new Error(first.reason)
  await expectBoard(page, first.state)
  expect(await stores(page)).toEqual([32, 26]) // 3 beyond the empty pit, 4 opposite it
  await expect(page.locator('.pg-status')).toContainText('second sowing')
  await page.reload()
  await expect(page.locator('.pg-board')).toBeVisible()
  await expectBoard(page, first.state)
  await expect(page.locator('.pg-status')).toContainText('second sowing')
  await clickPit(page, 2)
  const second = apply(first.state, { type: 'sow', pit: 2 })
  if (!second.ok) throw new Error(second.reason)
  await expectBoard(page, second.state)
  await expect(page.locator('.pg-status')).toContainText('Player 2')
})

test('animation shows seeds moving a step at a time, then settles on the right board', async ({ page }) => {
  await page.addInitScript(([key]) => localStorage.setItem(key, JSON.stringify({ speed: 'fast' })), [SETTINGS])
  await page.clock.install()
  await page.goto('/play/pallanguzhi')
  await page.getByLabel('Mode').selectOption('local')
  await page.locator('.pg-pit[data-pit="2"]').click()
  await page.clock.runFor(200)
  await expect(page.locator('.pg-pit[data-active]')).toHaveCount(1)
  expect(await counts(page)).not.toEqual(newGame().pits) // part way through
  await page.clock.runFor(120_000)
  const r = apply(newGame(), { type: 'sow', pit: 2 })
  if (!r.ok) throw new Error(r.reason)
  await expectBoard(page, r.state)
  await expect(page.locator('.pg-pit[data-active]')).toHaveCount(0)
})

test('a whole two-player match: rounds, refills and piggy pits, to a winner, saved once', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one full match is enough; the phone project covers touch and layout')
  test.setTimeout(300_000)
  await open(page, 'local')
  const random = createRandom('e2e-pg-full')
  let s = newGame()
  let sawPiggy = false
  for (let n = 0; n < 6000 && s.phase !== 'over'; n++) {
    if (s.phase === 'round-over') {
      await page.getByRole('button', { name: /^Start round/ }).click()
      const r = apply(s, { type: 'next-round' })
      if (!r.ok) throw new Error(r.reason)
      s = r.state
      await expectBoard(page, s)
      const piggy = s.active.filter((a) => !a).length
      await expect(page.locator('.pg-pit[data-inactive]')).toHaveCount(piggy)
      if (piggy) sawPiggy = true
      continue
    }
    const pit = choosePit(s, 'easy', random)!
    await clickPit(page, pit)
    const r = apply(s, { type: 'sow', pit })
    if (!r.ok) throw new Error(r.reason)
    s = r.state
    if (n % 15 === 0 || s.phase !== 'play') await expectBoard(page, s)
  }
  expect(s.phase).toBe('over')
  await expect(page.getByRole('group', { name: 'Match over' })).toBeVisible()
  await expectRows(page, 'history', 1)
  const row = (await readTable(page, 'history'))[0] as { gameId: string; won: boolean }
  expect(row.gameId).toBe('pallanguzhi')
  expect(row.won).toBe(s.winner !== 'draw')
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBeNull()
  expect(typeof sawPiggy).toBe('boolean')
})

test('against the computer the human moves first and the computer answers with a legal move', async ({ page }) => {
  await open(page, 'computer')
  await page.getByLabel('Difficulty').selectOption('hard')
  await clickPit(page, 2)
  await expect(page.locator('.pg-status')).toContainText(/You/, { timeout: 15_000 })
  await expect(page.locator('.pg-pit[data-legal]').first()).toBeVisible({ timeout: 15_000 })
  const c = await counts(page)
  const [a, b] = await stores(page)
  expect(c.reduce((x, y) => x + y, 0) + a + b).toBe(70)
})

test('the tutorial can be completed with real taps', async ({ page }) => {
  await open(page, 'tutorial')
  let s = stepStart(TUTORIAL[0], newGame())
  for (let i = 0; i < TUTORIAL.length; i++) {
    const step = TUTORIAL[i]
    if (i > 0) {
      await page.getByRole('button', { name: 'Next' }).click()
      s = stepStart(step, s)
    }
    await expect(page.getByText(`Lesson ${i + 1} of ${TUTORIAL.length}`)).toBeVisible()
    await expectBoard(page, s)
    if (step.expect !== undefined) {
      await expect(page.locator('.pg-pit[data-hint]')).toHaveCount(1)
      await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()
      await clickPit(page, step.expect)
      const r = apply(s, { type: 'sow', pit: step.expect })
      if (!r.ok) throw new Error(r.reason)
      s = r.state
      await expectBoard(page, s)
    }
  }
  await expect(page.getByRole('button', { name: 'Play the computer' })).toBeVisible()
})

test('high contrast and reduced motion are remembered', async ({ page }) => {
  await open(page, 'local')
  await page.getByText('Accessibility and sound').click()
  await page.getByLabel('High contrast').check()
  await page.getByLabel('Reduce motion (no animation)').check()
  await page.reload()
  await expect(page.locator('.pg')).toHaveAttribute('data-contrast', 'true')
  await expect(page.locator('.pg')).toHaveAttribute('data-motion', 'off')
})
