import { expect, test, type Page } from '@playwright/test'
import { applyAction, newGame } from '../src/games/worldtrip/rules'
import { expectRows, readTable } from './helpers'

/**
 * Plays every human turn to the end of the trip, doing the least: roll, pass on stops (which sends them to auction, so drop out),
 * roll again after doubles, and wait while a computer plays. Doubles and the Hotel Stopover make the number of clicks vary, so it loops until the standings show.
 */
async function finishTrip(page: Page, afterFirstRoll?: () => Promise<void>) {
  const standings = page.getByRole('list', { name: 'Final standings' })
  const moves = [page.getByRole('button', { name: /^Roll (dice|for doubles)$/ }), page.getByRole('button', { name: /^Move \d+ spaces$/ }), page.getByRole('button', { name: 'Pass', exact: true }), page.getByRole('button', { name: 'Drop out' }), page.getByRole('button', { name: /^(End turn|Roll again)$/ })]
  let rolled = false
  for (let i = 0; i < 900; i++) {
    if (await standings.isVisible()) return
    let clicked = false
    for (const button of moves) {
      if ((await button.isVisible()) && (await button.isEnabled({ timeout: 500 }).catch(() => false))) {
        await button.click({ timeout: 3000 }).catch(() => undefined) // a button can vanish as the piece finishes walking
        if (!rolled && button === moves[0] && afterFirstRoll) { rolled = true; await afterFirstRoll() }
        clicked = true
        break
      }
    }
    if (!clicked) await page.waitForTimeout(150)
  }
  throw new Error('the trip did not finish')
}

test('plays a complete match offline, resumes after a reload and records the result once', async ({ page, context }) => {
  test.setTimeout(240_000) // each human roll now walks the piece square by square
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  await page.goto('/play/world-trip?seed=trip-test')
  await expect(page.getByRole('list', { name: 'Board in travel order' }).getByRole('button')).toHaveCount(40)
  await page.getByLabel('Computers').selectOption('0')
  await page.getByRole('button', { name: 'Start match' }).click()
  await finishTrip(page, async () => {
    await page.reload()
    await expect(page.locator('.wt-status')).toContainText('Round 1 of 12 · Player 1. Rolled')
  })
  await expect(page.getByRole('list', { name: 'Final standings' })).toBeVisible()
  await expectRows(page, 'history', 1)
  await page.reload()
  await expect(page.getByRole('list', { name: 'Final standings' })).toBeVisible()
  expect(await readTable(page, 'history')).toMatchObject([{ gameId: 'world-trip', won: true }])
})

test('a buyer can accept a saved offer for a stop', async ({ page }) => {
  const seed = Array.from({ length: 60 }, (_, i) => `deal-${i}`).find((s) => applyAction(newGame(2, s), { type: 'roll' }).phase === 'buy')!
  await page.goto(`/play/world-trip?seed=${seed}`)
  await page.getByLabel('Computers').selectOption('0')
  await page.getByRole('button', { name: 'Start match' }).click()
  await page.getByRole('button', { name: 'Roll dice' }).click()
  await page.getByRole('button', { name: /^Move \d+ spaces$/ }).click()
  await page.getByRole('button', { name: /^Claim / }).click()
  await expect(page.getByRole('region', { name: 'Property cards' })).toContainText('Player 1')
  await page.getByText('Propose a trade', { exact: true }).click()
  await page.getByRole('group', { name: 'You give' }).getByRole('checkbox').first().check()
  await page.getByLabel('Credits from them').fill('150')
  await page.getByRole('button', { name: 'Offer trade' }).click()
  await page.reload()
  await expect(page.getByRole('region', { name: 'Pending offer' })).toContainText('Pass the device to Player 2')
  await page.getByRole('button', { name: 'Accept offer' }).click()
  await expect(page.getByRole('list', { name: 'Player balances' })).toContainText('Player 2')
  await expect(page.getByRole('list', { name: 'Board in travel order' }).getByRole('button', { name: /owned by Player 2/ })).toHaveCount(1)
})

test('the board and the action buttons are on screen at phone size', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/play/world-trip?seed=fit')
  await page.getByLabel('Computers').selectOption('0')
  await page.getByRole('button', { name: 'Start match' }).click()
  for (const sel of ['.wt-board', '.wt-actions button']) {
    const box = (await page.locator(sel).first().boundingBox())!
    expect(box.y + box.height, `${sel} inside the viewport`).toBeLessThanOrEqual(667)
  }
})

test('a computer opponent takes its turns on its own and the match saves once', async ({ page }) => {
  test.setTimeout(240_000)
  await page.goto('/play/world-trip?seed=cpu-test')
  await page.getByLabel('Turns each').selectOption('12')
  await page.getByRole('button', { name: 'Start match' }).click() // default: you and one computer
  await finishTrip(page)
  await expect(page.getByRole('list', { name: 'Final standings' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Computer 1').first()).toBeVisible()
  await expectRows(page, 'history', 1)
})

test('after a roll you press Move and your piece walks before you can claim the stop', async ({ page }) => {
  const seed = Array.from({ length: 60 }, (_, i) => `deal-${i}`).find((s) => applyAction(newGame(2, s), { type: 'roll' }).phase === 'buy')!
  await page.goto(`/play/world-trip?seed=${seed}`)
  await page.getByLabel('Computers').selectOption('0')
  await page.getByRole('button', { name: 'Start match' }).click()
  await page.getByRole('button', { name: 'Roll dice' }).click()
  await expect(page.getByRole('button', { name: /^Claim / })).toHaveCount(0)
  await expect(page.locator('.wt-status')).toContainText('Press Move')
  await page.getByRole('button', { name: /^Move \d+ spaces$/ }).click()
  await expect(page.getByRole('button', { name: /^Claim / })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Selected stop' }).locator('.wt-deed')).toBeVisible()
})
