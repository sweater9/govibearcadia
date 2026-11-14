import { expect, test } from '@playwright/test'
import { createRandom } from '../src/lib/rng'
import { chooseMove } from '../src/games/chess/ai'
import { apply, newGame, squareName, status, type Move } from '../src/games/chess/rules'
import { expectRows, readTable } from './helpers'

// The pure rules and the computer are plain TypeScript, so the spec plays the whole game out first: a stronger
// "oracle" for White against the Easy computer, whose replies depend only on the seed. Then it plays the same
// White moves through the real board with clicks and checks the checkmate and the saved result.
const SEED = 'c5'
const sq = (n: number) => `button[aria-label^="${squareName(n)},"]`

function simulate() {
  const computer = createRandom(`${SEED}-0`)
  const oracle = createRandom('oracle')
  let s = newGame()
  const mine: Move[] = []
  for (let ply = 0; ply < 120 && status(s) === 'playing'; ply++) {
    const m = chooseMove(s, ply % 2 === 0 ? 'normal' : 'easy', ply % 2 === 0 ? oracle : computer)!
    if (ply % 2 === 0) mine.push(m)
    s = apply(s, m)!
  }
  return { mine, final: s }
}

test('playing White to checkmate against Easy wins and saves the result once', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'one full game is enough; the phone project covers layout')
  test.setTimeout(240_000)
  const { mine, final } = simulate()
  expect(status(final)).toBe('checkmate')

  await page.clock.install()
  await page.goto(`/play/chess?seed=${SEED}`)
  await page.getByRole('button', { name: 'Easy' }).click()
  await page.getByRole('button', { name: 'Play White' }).click()
  await expect(page.locator('.ch-board')).toBeVisible()

  for (const m of mine) {
    await page.locator(sq(m.from)).click()
    await page.locator(sq(m.to)).click()
    if (m.promo) await page.getByRole('button', { name: { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' }[m.promo] }).click()
    if (status(final) === 'checkmate' && m === mine[mine.length - 1]) break
    await page.clock.runFor(500) // the computer replies after a short pause
  }

  await expect(page.getByText('You win!')).toBeVisible()
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'chess', won: true, score: 300 + Math.max(0, 300 - final.full * 3) })
  await page.clock.runFor(5000)
  await expectRows(page, 'history', 1)
})

test('resigning saves a loss and New game returns to the setup', async ({ page }) => {
  await page.goto(`/play/chess?seed=${SEED}`)
  await page.getByRole('button', { name: 'Play White' }).click()
  await page.locator(sq(52)).click() // e2
  await page.locator(sq(36)).click() // e4
  await page.getByRole('button', { name: 'Resign' }).click()
  await expect(page.getByText('You resigned')).toBeVisible()
  await expectRows(page, 'history', 1)
  expect((await readTable(page, 'history'))[0]).toMatchObject({ gameId: 'chess', won: false, score: 0 })
  await page.locator('.ch-over').getByRole('button', { name: 'New game' }).click()
  await expect(page.getByRole('button', { name: 'Play Black' })).toBeVisible()
})
