import { expect, test } from '@playwright/test'
import { nearlyDeclared } from '../src/games/rummy/endgame'
import { expectRows, overflowsHorizontally, readTable } from './helpers'

test('a new game deals 13 cards, a draw makes 14, and the stock shrinks', async ({ page }) => {
  await page.goto('/play/indian-rummy?seed=e2e-rummy')
  await page.getByRole('button', { name: 'Start game' }).click()
  await expect(page.locator('.rm-hand .rm-card')).toHaveCount(13)
  await page.getByRole('button', { name: /Draw from the stock/ }).click()
  await expect(page.locator('.rm-hand .rm-card')).toHaveCount(14)
  await expect(page.getByRole('button', { name: /Draw from the stock, 77 cards/ })).toBeDisabled()
  expect(await overflowsHorizontally(page)).toBe(false)
})

test('a staged hand is declared with real clicks, the win is saved once, and a reload resumes the finished save', async ({ page }) => {
  const { seed, actions, declare } = nearlyDeclared('e2e-rummy-')
  await page.addInitScript(([key, value]) => { if (!sessionStorage.getItem('staged')) { localStorage.setItem(key, value); sessionStorage.setItem('staged', '1') } }, ['govibearcadia.rummy.v1', JSON.stringify({ players: 2, seed, actions, startedAt: 1, layout: declare.groups })])
  await page.goto(`/play/indian-rummy?seed=${seed}`)
  await expect(page.locator('.rm-group[data-kind="pure"]').first()).toBeVisible()
  await page.locator(`.rm-hand [data-card="${declare.card}"]`).click()
  await page.getByRole('button', { name: 'Declare' }).click()
  await expect(page.locator('.rm-status.win-message')).toContainText('You win')
  await expectRows(page, 'history', 1)
  expect((await readTable(page, 'history'))[0]).toMatchObject({ gameId: 'indian-rummy' })
})

test('pressing S draws from the stock', async ({ page }) => {
  await page.goto('/play/indian-rummy?seed=e2e-rummy-key')
  await page.getByRole('button', { name: 'Start game' }).click()
  await page.keyboard.press('s')
  await expect(page.locator('.rm-hand .rm-card')).toHaveCount(14)
})
