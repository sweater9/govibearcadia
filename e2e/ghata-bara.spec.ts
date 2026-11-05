import { expect, test, type Page } from '@playwright/test'
import { createRandom } from '../src/lib/rng'
import { dice, rollTotal, newGame, innerKey, LAYOUTS, type State } from '../src/games/ghata/rules'
import { expectRows, overflowsHorizontally, readTable } from './helpers'

// Ghata Bara: crafted positions are put in through the saved-game slot, so the real UI is checked against exact rules.

const KEY = 'govibearcadia.ghata'
const T0 = new Date('2026-10-28T10:00:00Z')

async function stage(page: Page, state: State, humans = 1) {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [KEY, JSON.stringify({ v: 1, seed: 'e2e', draws: 0, humans, state })])
}
/** Violet has a Juga (pawns 0 and 1) on i2 and Cyan's pawn 6 on i3, with a 2 to move. */
function jugaNextToEnemy(pinned: boolean): State {
  const s = newGame()
  s.phase = 'move'
  s.queue = [2]
  s.entered = [true, true, true, true]
  s.nextJuga = 2
  for (const id of [0, 1]) Object.assign(s.pawns[id], { where: 'juga', at: 1, credit: true })
  s.jugas.push({ id: 1, seat: 0, at: 1, pawns: [0, 1], pinned: pinned ? 6 : null })
  // Cyan enters the inner ring at i7, so i3 is 4 steps in, and i2 is 3.
  Object.assign(s.pawns[6], { where: 'inner', at: pinned ? 3 : 4, credit: true, pinnedBy: pinned ? 1 : null })
  return s
}

test('the 7x7 board has the 13 X squares of the cloth, a Home in the middle, and four seats; the 5x5 is still there', async ({ page }) => {
  await page.goto('/play/ghata-bara?seed=e2e-gb')
  await expect(page.locator('.gb-sq')).toHaveCount(49)
  await expect(page.locator('.gb-sq[data-safe]')).toHaveCount(13)
  for (const sq of ['o0', 'o6', 'o12', 'o18', 'c']) await expect(page.locator(`[data-square="${sq}"]`)).toHaveAttribute('data-safe', 'true')
  await expect(page.locator('.gb-seats li')).toHaveCount(4)
  await expect(page.locator('.gb-seats li').first()).toContainText('Yard 6 · Home 0/6')
  expect(await overflowsHorizontally(page)).toBe(false)
  await page.getByLabel('Board size').selectOption('5')
  await expect(page.locator('.gb-sq')).toHaveCount(25)
  await expect(page.locator('.gb-sq[data-safe]')).toHaveCount(5)
})

test('pressing R rolls the two dice; the seeded roll is the one the rules produce', async ({ page }) => {
  const [a, b] = dice(createRandom('e2e-gb'))
  const total = rollTotal(a, b)
  await page.clock.install({ time: T0 })
  await page.goto('/play/ghata-bara?seed=e2e-gb')
  await expect(page.getByRole('button', { name: 'Roll' })).toBeEnabled()
  await page.keyboard.press('r')
  await expect(page.getByRole('button', { name: 'Rolling…' })).toBeVisible()
  await page.clock.runFor(520)
  const word = total === 6 ? 'Chowka (6)' : total === 12 ? 'Baara (12)' : String(total)
  await expect(page.getByRole('status')).toContainText(`Violet rolled ${word}`)
  await expect(page.locator('.gb-die').first()).toHaveText(a === 6 ? '' : String(a))
})

test('a Juga landing on a lone enemy pawn pins it, using the mouse', async ({ page }) => {
  await stage(page, jugaNextToEnemy(false))
  await page.goto('/play/ghata-bara')
  await expect(page.locator('.gb-juga')).toHaveCount(1)
  await page.locator('[data-square="i2"]').click()
  await expect(page.locator('[data-square="i3"]')).toHaveAttribute('data-target', '')
  await expect(page.locator('[data-square="i3"] .gb-badge')).toHaveText('2')
  await page.locator('[data-square="i3"]').click()
  await expect(page.locator('.gb-pawn[data-pinned]')).toHaveCount(1)
  await expect(page.getByRole('status')).toContainText('Violet pinned a pawn')
  await expect(page.locator('.gb-juga[data-holding]')).toHaveCount(1)
})

test('leaving a pin captures the pawn, and the capture earns one bonus roll, with the keyboard alone', async ({ page }) => {
  const s = jugaNextToEnemy(true)
  await stage(page, s)
  await page.goto('/play/ghata-bara')
  await expect(page.locator('.gb-pawn[data-pinned]')).toHaveCount(1)
  await page.locator('[data-square="i2"]').focus()
  await page.keyboard.press('Enter')
  await page.locator('[data-square="i3"]').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status')).toContainText('Violet captured 1 pawn')
  await expect(page.getByRole('status')).toContainText('capture bonus roll')
  await expect(page.locator('.gb-seats li').nth(1)).toContainText('Yard 6')
  await expect(page.locator('.gb-pawn[data-pinned]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Roll' })).toBeEnabled() // Violet rolls again
})

test('a game in progress is saved on this device and restored after a reload', async ({ page }) => {
  await page.clock.install({ time: T0 })
  await page.goto('/play/ghata-bara')
  await page.clock.pauseAt(new Date(T0.getTime() + 1000))
  await page.getByRole('button', { name: 'Roll' }).click()
  await page.clock.runFor(520) // the roll lands; the computer's pause has not run out yet
  const before = await page.locator('.gb-seats').innerText()
  const status = await page.getByRole('status').innerText()
  await page.reload()
  await expect(page.getByRole('status')).toContainText('saved game was restored')
  expect(await page.locator('.gb-seats').innerText()).toBe(before)
  expect(status).toContain('Violet rolled')
})

test('choosing 2 players seats people opposite each other', async ({ page }) => {
  await page.goto('/play/ghata-bara?seed=e2e-gb')
  await page.getByLabel('Players').selectOption('2')
  const seats = page.locator('.gb-seats li')
  await expect(seats.nth(0)).toContainText('Player')
  await expect(seats.nth(1)).toContainText('Computer')
  await expect(seats.nth(2)).toContainText('Player')
  await expect(seats.nth(3)).toContainText('Computer')
})

test('a whole four-player game can be played to the end, and the result is saved once', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one full game is enough; the phone project covers layout and touch')
  test.setTimeout(420_000)
  await page.clock.install({ time: T0 })
  await page.goto('/play/ghata-bara?seed=e2e-full')
  await page.clock.pauseAt(new Date(T0.getTime() + 1000))
  for (let step = 0; step < 8000; step++) {
    const view = await page.evaluate(() => ({
      over: !!document.querySelector('.gb-status')?.textContent?.includes('wins!'),
      roll: !(document.querySelector('.gb-roll') as HTMLButtonElement).disabled,
      release: Array.from(document.querySelectorAll('button')).some((b) => b.textContent?.startsWith('Release a pawn')),
      movable: !!document.querySelector('.gb-sq[data-movable]'),
    }))
    if (view.over) break
    if (view.roll) {
      await page.getByRole('button', { name: 'Roll' }).click()
      await page.clock.runFor(520)
    } else if (view.release) await page.getByRole('button', { name: /^Release a pawn/ }).first().click()
    else if (view.movable) {
      await page.locator('.gb-sq[data-movable]').first().click()
      await page.locator('.gb-sq[data-target]').first().click()
    } else await page.clock.runFor(400)
  }
  const text = await page.getByRole('status').innerText()
  expect(text).toMatch(/\w+ wins!/)
  await expectRows(page, 'history', 1)
  const row = (await readTable(page, 'history'))[0] as { gameId: string; won: boolean; score: number }
  expect(row.gameId).toBe('ghata-bara')
  expect(row.won).toBe(text.includes('Violet wins!'))
  const home = Number((await page.locator('.gb-seats li').first().innerText()).match(/Home (\d)\/6/)![1])
  expect(row.score).toBe(home * 100 + (row.won ? 400 : 0))
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBeNull()
})

/** The 7x7 board with Violet's pawn 0 on its turn square, two before its own start, ready to move. */
function sevenAtTurn(credit: boolean, queue: number[]): State {
  const s = newGame(7)
  s.phase = 'move'
  s.queue = queue
  Object.assign(s.pawns[0], { where: 'outer', at: 22, credit })
  return s
}

test('7x7: a pawn with a capture turns inward from the square two before its start, following the arrows', async ({ page }) => {
  await stage(page, sevenAtTurn(true, [1]))
  await page.goto('/play/ghata-bara')
  await page.locator('[data-square="o22"]').click()
  const entry = `i${LAYOUTS[7].interiorCells.findIndex(([r, c]) => r === 1 && c === 5)}` // the middle ring's top-right corner for the top seat
  expect(innerKey(0, 0, 7)).toBe(entry)
  await expect(page.locator(`[data-square="${entry}"]`)).toHaveAttribute('data-target', '')
  await expect(page.locator('[data-square="o23"]')).not.toHaveAttribute('data-target', '')
  await page.locator(`[data-square="${entry}"]`).click()
  await expect(page.locator(`[data-square="${entry}"] .gb-pawn`)).toHaveCount(1)
})

test('7x7: a pawn with no capture keeps circling the outer ring', async ({ page }) => {
  await stage(page, sevenAtTurn(false, [2]))
  await page.goto('/play/ghata-bara')
  await page.locator('[data-square="o22"]').click()
  await expect(page.locator('[data-square="o0"]')).toHaveAttribute('data-target', '') // past the turn square, onto its start
  await expect(page.locator('[data-target]')).toHaveCount(1)
})

test('a player chooses a piece, it appears on the board and the player card, and it is remembered for next time', async ({ page }) => {
  await stage(page, jugaNextToEnemy(false))
  await page.goto('/play/ghata-bara')
  const button = page.getByRole('button', { name: /^Piece:/ }).first()
  const before = await button.innerText()
  await button.click()
  const free = page.locator('[data-token-option]:not([disabled])[aria-checked="false"]').first() // some piece nobody holds
  const chosen = (await free.getAttribute('aria-label'))!
  await free.click()
  await expect(button).toHaveText(`Piece: ${chosen}`)
  expect(`Piece: ${chosen}`).not.toBe(before)
  await expect(page.locator('.gb-seats li').first().locator('svg')).toBeVisible()
  await expect(page.locator('.gb-juga svg')).toHaveCount(2) // the Juga carries the same piece
  await page.evaluate((k) => localStorage.removeItem(k), KEY) // a brand new game, same device
  await page.reload()
  await expect(page.getByRole('button', { name: /^Piece:/ }).first()).toHaveText(`Piece: ${chosen}`)
})

test('Roll is a big button at the lower right, within thumb reach and fully on screen', async ({ page }) => {
  await page.goto('/play/ghata-bara?seed=e2e-gb')
  const roll = (await page.getByRole('button', { name: 'Roll' }).boundingBox())!
  const board = (await page.locator('.gb-board').boundingBox())!
  const view = page.viewportSize()!
  expect(roll.y).toBeGreaterThan(board.y + board.height - 1) // below the board
  expect(roll.y + roll.height).toBeLessThanOrEqual(view.height)
  expect(roll.x + roll.width / 2).toBeGreaterThan(view.width / 2) // right half
  expect(roll.height).toBeGreaterThanOrEqual(48)
})
