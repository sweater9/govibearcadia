import { expect, test, type Page } from '@playwright/test'
import { createRandom } from '../src/lib/rng'
import { newGame, reveal, type MinesState } from '../src/games/minesweeper/rules'
import { expectRows, readTable } from './helpers'

// `?seed=` makes the game deterministic, and the rules are pure TypeScript, so the test can compute
// the exact mine layout the page will deal, then play it through the real UI.

const cell = (page: Page, r: number, c: number) => page.locator(`.mines-grid [data-r="${r}"][data-c="${c}"]`)
const label = (r: number, c: number, what: string) => `Row ${r + 1}, column ${c + 1}: ${what}`

/** The board after the first click at (4, 4) for a seed: where the mines are, and what the opening revealed. */
const dealt = (seed: string): MinesState => reveal(newGame(), 4, 4, createRandom(seed))
const all = (state: MinesState) => state.cells.flatMap((row, r) => row.map((c, col) => ({ r, c: col, cell: c })))

async function start(page: Page, seed: string) {
  await page.clock.install() // fake timers, so tests can advance the in-game clock with runFor
  await page.goto(`/play/minesweeper?seed=${seed}`)
  await expect(page.locator('.mine-cell')).toHaveCount(81)
}

test('clearing the whole board wins and saves the result once', async ({ page }) => {
  const seed = 'e2e-win'
  await start(page, seed)
  await page.clock.setFixedTime(new Date('2026-10-28T10:00:00Z')) // Date stops moving, so the time bonus is exact
  const model = dealt(seed)

  await cell(page, 4, 4).click()
  for (const { r, c, cell: m } of all(model)) {
    if (!m.mine && m.state === 'hidden') await cell(page, r, c).click()
  }

  await expect(page.getByText(/Field cleared!/)).toBeVisible()
  await expect(page.locator('.mine-cell.flagged')).toHaveCount(10) // every mine is marked
  await expect(page.getByText('Mines', { exact: true }).locator('xpath=following-sibling::strong')).toHaveText('0')

  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'minesweeper', won: true, score: 71 * 10 + 200 + 300 * 2 })
  const [progress] = await readTable(page, 'progress')
  expect(progress).toMatchObject({ gameId: 'minesweeper', plays: 1, highScore: 1510 })
})

test('hitting a mine loses, shows the mines, and scores the cells opened', async ({ page }) => {
  const seed = 'e2e-loss'
  await start(page, seed)
  const model = dealt(seed)
  const mine = all(model).find((x) => x.cell.mine)!

  await cell(page, 4, 4).click()
  await cell(page, mine.r, mine.c).click()

  await expect(page.getByText(/Boom!/)).toBeVisible()
  await expect(cell(page, mine.r, mine.c)).toHaveClass(/boom/)
  await expect(page.locator('.mine-cell.open', { hasText: '✹' })).toHaveCount(10) // all mines revealed

  await expectRows(page, 'history', 1)
  expect((await readTable(page, 'history'))[0]).toMatchObject({ gameId: 'minesweeper', won: false, score: model.opened * 10 })

  // The board is dead: more clicks change nothing and record nothing.
  await cell(page, 0, 0).click({ force: true })
  await expectRows(page, 'history', 1)
})

test('the first click is always safe, wherever you start', async ({ page }) => {
  await start(page, 'e2e-corner')
  await cell(page, 0, 0).click() // a corner, the classic place to lose on move one
  await expect(page.getByText(/Boom!/)).toHaveCount(0)
  expect(await page.locator('.mine-cell.open').count()).toBeGreaterThan(1)
})

test('flags: right-click on desktop, Flag mode on touch; a flagged cell is protected', async ({ page, isMobile }) => {
  await start(page, 'e2e-flags')
  const minesLeft = page.getByText('Mines', { exact: true }).locator('xpath=following-sibling::strong')
  await expect(minesLeft).toHaveText('10')

  if (isMobile) {
    const toggle = page.getByRole('button', { name: /Flag mode/ })
    await toggle.tap()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await cell(page, 0, 0).tap()
  } else {
    await cell(page, 0, 0).click({ button: 'right' })
  }
  await expect(cell(page, 0, 0)).toHaveAttribute('aria-label', label(0, 0, 'flagged'))
  await expect(minesLeft).toHaveText('9')

  if (!isMobile) {
    await cell(page, 0, 0).click() // plain click must not open a flagged cell
    await expect(cell(page, 0, 0)).toHaveAttribute('aria-label', label(0, 0, 'flagged'))
    await cell(page, 0, 0).click({ button: 'right' })
  } else {
    await cell(page, 0, 0).tap() // still in flag mode: toggles it back off
  }
  await expect(cell(page, 0, 0)).toHaveAttribute('aria-label', label(0, 0, 'hidden'))
  await expect(minesLeft).toHaveText('10')
  await expectRows(page, 'history', 0)
})

test('the board can be played with the keyboard alone', async ({ page }) => {
  await start(page, 'e2e-keys')
  await cell(page, 0, 0).focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowDown')
  await expect(cell(page, 1, 1)).toBeFocused()

  await page.keyboard.press('f')
  await expect(cell(page, 1, 1)).toHaveAttribute('aria-label', label(1, 1, 'flagged'))
  await page.keyboard.press('f') // unflag again: a flagged cell would (correctly) be skipped by the opening cascade
  await expect(cell(page, 1, 1)).toHaveAttribute('aria-label', label(1, 1, 'hidden'))

  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown')
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight')
  await expect(cell(page, 4, 4)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('.mine-cell.open').first()).toBeVisible()
  expect(await page.locator('.mine-cell.open').count()).toBe(dealt('e2e-keys').opened)

  // One cell stays in the tab order, so Tab does not walk 81 buttons.
  await expect(page.locator('.mine-cell[tabindex="0"]')).toHaveCount(1)
})

test('the clock runs while playing and stops when the game ends', async ({ page }) => {
  const seed = 'e2e-clock'
  await start(page, seed)
  const time = page.getByText('Time', { exact: true }).locator('xpath=following-sibling::strong')
  await expect(time).toHaveText('0')

  await cell(page, 4, 4).click()
  await page.clock.runFor(5000)
  await expect(time).toHaveText('5')

  const mine = all(dealt(seed)).find((x) => x.cell.mine)!
  await cell(page, mine.r, mine.c).click()
  await page.clock.runFor(10_000)
  await expect(time).toHaveText('5') // stopped at the moment of the loss
})

test('starting a new board without finishing records nothing and resets the board', async ({ page }) => {
  await start(page, 'e2e-new')
  await cell(page, 4, 4).click()
  await expect(page.locator('.mine-cell.open').first()).toBeVisible()

  await page.getByRole('button', { name: 'New', exact: true }).click()
  await expect(page.locator('.mine-cell.hidden')).toHaveCount(81)
  await expectRows(page, 'history', 0)
})

test('different seeds deal different boards, the same seed deals the same one', async ({ page }) => {
  const openedAfterFirstClick = async (seed: string) => {
    await page.goto(`/play/minesweeper?seed=${seed}`)
    await cell(page, 4, 4).click()
    return page.locator('.mine-cell.open').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')).join('|'))
  }
  const a1 = await openedAfterFirstClick('same')
  const a2 = await openedAfterFirstClick('same')
  const b = await openedAfterFirstClick('different')
  expect(a1).toBe(a2)
  expect(b).not.toBe(a1)
})
