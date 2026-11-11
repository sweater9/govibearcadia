import { expect, test } from '@playwright/test'
import { nearlyWon } from '../src/games/ludo/endgame'
import { expectRows, overflowsHorizontally, readTable } from './helpers'

test('a staged match is finished with real clicks and the win is saved once', async ({ page }) => {
  test.setTimeout(120_000)
  const { seed, actions } = nearlyWon('e2e-ludo-')
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), ['govibearcadia.ludo.v1', JSON.stringify({ count: 2, computers: 1, seed, actions, startedAt: 1 })])
  await page.goto(`/play/ludo?seed=${seed}`)
  await expect(page.locator('.ld-board')).toBeVisible()
  expect(await overflowsHorizontally(page)).toBe(false)
  const done = page.locator('.win-message, .game-over').first()
  for (let i = 0; i < 40 && !(await done.isVisible()); i++) {
    const roll = page.getByRole('button', { name: 'Roll dice' })
    if ((await roll.count()) && (await roll.isEnabled({ timeout: 500 }).catch(() => false))) await roll.click({ timeout: 2000 }).catch(() => {})
    const movable = page.locator('.ld-token[data-movable]').first()
    if (await movable.count()) await movable.click({ timeout: 2000 }).catch(() => {})
    await page.waitForTimeout(500)
  }
  await expectRows(page, 'history', 1)
  const rows = await readTable(page, 'history')
  expect(rows[0]).toMatchObject({ gameId: 'ludo' })
})

test('a new match shows the 15x15 board with eight tokens in the yards', async ({ page }) => {
  await page.goto('/play/ludo?seed=e2e-ludo-board')
  await page.getByRole('button', { name: 'Start match' }).click()
  await expect(page.locator('.ld-c')).toHaveCount(225)
  await expect(page.locator('.ld-token')).toHaveCount(8)
})
