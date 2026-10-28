import { expect, test, type Page } from '@playwright/test'
import { par, scoreFor, solve, type Action } from '../src/games/gravity/rules'
import { expectRows, readTable } from './helpers'

// Solutions come from the pure rules' own search; the page is then played with real taps.

const BUTTON: Record<Action, string> = { L: 'Move left', R: 'Move right', F: 'Flip gravity' }

async function open(page: Page) {
  await page.goto('/play/gravity-flip')
  await expect(page.locator('.gf-board')).toBeVisible()
}
const tap = async (page: Page, actions: Action[]) => {
  for (const a of actions) await page.getByRole('button', { name: BUTTON[a] }).click()
}

test('solving level 1 with real taps saves a perfect score', async ({ page }) => {
  await open(page)
  await tap(page, solve(0)!)
  await expect(page.getByText(/Level cleared in 10 moves/)).toBeVisible()
  await expectRows(page, 'history', 1)
  expect((await readTable(page, 'history'))[0]).toMatchObject({ gameId: 'gravity-flip', won: true, score: scoreFor(par(0)!, par(0)!) })
})

test('two wasted flips cost 100 points, and the next level saves a second result', async ({ page }) => {
  await open(page)
  await tap(page, ['F', 'F', ...solve(0)!])
  await expect(page.getByText(/Level cleared in 12 moves/)).toBeVisible()
  await expectRows(page, 'history', 1)
  expect((await readTable(page, 'history'))[0]).toMatchObject({ score: 900 })

  await page.getByRole('button', { name: 'Continue to next level' }).click()
  await expect(page.getByText('2/10')).toBeVisible()
  await tap(page, solve(1)!)
  await expectRows(page, 'history', 2)
})

test('spikes kill, undo brings you back, and nothing is saved', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Next level' }).click()
  await page.getByRole('button', { name: 'Next level' }).click()
  await expect(page.getByText('3/10')).toBeVisible()
  await tap(page, ['R', 'R', 'R'])
  await expect(page.getByText('Spiked!')).toBeVisible()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByText('Spiked!')).toBeHidden()
  await expectRows(page, 'history', 0)
})

test('keyboard: arrows, space and Z', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'keyboard input')
  await open(page)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Space')
  await expect(page.getByLabel('Moves')).toHaveText('2')
  await page.keyboard.press('z')
  await expect(page.getByLabel('Moves')).toHaveText('1')
  await page.keyboard.press('r')
  await expect(page.getByLabel('Moves')).toHaveText('0')
})
