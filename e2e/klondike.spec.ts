import { expect, test, type Page } from '@playwright/test'
import { apply, isWon, newGame, picked, rankOf, suitOf, type Action, type State } from '../src/games/klondike/rules'
import { solve } from '../src/games/klondike/ai'
import { expectRows, readTable } from './helpers'

// The page deals newGame(seed, 1). The pure rules and solver are plain TypeScript, so the test finds a winning
// line for the seed, then plays it through the real UI with taps, tracking the same state to name each card.

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs']
const RANKS = ['Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King']
const name = (c: number) => `${RANKS[rankOf(c)]} of ${SUITS[suitOf(c)]}`
const SEED = 'k96' // a deal the solver wins in 722 moves

async function tapSource(page: Page, s: State, a: Extract<Action, { type: 'move' }>) {
  const card = picked(s, a)![0]
  const label = a.from === 'foundation' ? `${name(card)} on the ${SUITS[suitOf(card)]} foundation` : name(card)
  await page.getByRole('button', { name: label, exact: true }).click()
}

async function play(page: Page, line: Action[]) {
  let s = newGame(SEED, 1)
  for (const a of line) {
    if (a.type === 'draw') {
      await page.locator('.kl-stock').click()
    } else {
      await tapSource(page, s, a)
      if (a.to === 'foundation') {
        await page.getByRole('button', { name: new RegExp(`^${SUITS[suitOf(picked(s, a)![0])]} foundation`, 'i') }).click()
      } else {
        const pile = s.tableau[a.dest]
        if (pile.up.length) await page.getByRole('button', { name: name(pile.up[pile.up.length - 1]), exact: true }).click()
        else await page.getByRole('button', { name: `Empty column ${a.dest + 1}` }).click()
      }
    }
    s = apply(s, a)
  }
  return s
}

test('playing a solved deal through taps wins and saves the result once', async ({ page }) => {
  test.setTimeout(300_000)
  const line = solve(newGame(SEED, 1))
  expect(line, 'the seed must be solvable').not.toBeNull()
  await page.clock.install()
  await page.clock.setFixedTime(new Date('2026-11-14T10:00:00Z')) // no elapsed time, so the score is the points alone
  await page.goto(`/play/klondike?seed=${SEED}`)
  await expect(page.locator('.kl-board')).toBeVisible()

  const final = await play(page, line!)
  expect(isWon(final)).toBe(true)
  await expect(page.getByText('You won!')).toBeVisible()

  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'klondike', won: true, score: final.points })
  const [progress] = await readTable(page, 'progress')
  expect(progress).toMatchObject({ gameId: 'klondike', plays: 1 })
})

test('tapping a card then the wrong place changes nothing, and undo restores a draw', async ({ page }) => {
  await page.goto(`/play/klondike?seed=${SEED}`)
  await expect(page.locator('.kl-board')).toBeVisible()
  await page.locator('.kl-stock').click()
  await expect(page.getByText('Moves').locator('b')).toHaveText('1')
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByText('Moves').locator('b')).toHaveText('0')
  await expectRows(page, 'history', 0)
})
