import { expect, test } from '@playwright/test'
import { cardName, newGame, potOf } from '../src/games/poker/rules'
import { expectRows, overflowsHorizontally, readTable } from './helpers'

test('the seeded deal is the one the rules produce: your two cards and the blinds in the pot', async ({ page }) => {
  const seed = 'e2e-poker'
  const s = newGame(3, seed)
  await page.goto(`/play/poker?seed=${seed}`)
  await page.getByLabel('Opponents').selectOption('2')
  await page.getByRole('button', { name: 'Start tournament' }).click()
  const labels = await page.locator('.pk-me .pk-card').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  expect(labels).toHaveLength(2)
  const names = s.players[0].hole.map(cardName)
  expect(labels.map((l) => l!.replace(' of spades', '♠').replace(' of hearts', '♥').replace(' of diamonds', '♦').replace(' of clubs', '♣'))).toEqual(names)
  await expect(page.locator('.pk-pot b')).toHaveText(String(potOf(s)))
  await expect(page.locator('.pk-seats li')).toHaveCount(2)
  expect(await overflowsHorizontally(page)).toBe(false)
})

test('shoving all-in with real clicks plays the tournament to a result that is saved once', async ({ page }) => {
  test.setTimeout(240_000)
  await page.goto('/play/poker?seed=e2e-poker-shove')
  await page.getByLabel('Opponents').selectOption('1')
  await page.getByRole('button', { name: 'Start tournament' }).click()
  const again = page.getByRole('button', { name: 'Play again' })
  for (let i = 0; i < 400 && !(await again.isVisible()); i++) {
    const next = page.locator('.pk-next')
    if (await next.count()) { await next.click({ timeout: 2000 }).catch(() => {}); continue }
    const allIn = page.getByRole('button', { name: 'All-in', exact: true })
    if ((await allIn.count()) && (await allIn.isEnabled({ timeout: 300 }).catch(() => false))) {
      await allIn.click({ timeout: 2000 }).catch(() => {})
      await page.locator('.pk-raise').click({ timeout: 2000 }).catch(() => {})
    } else if (await page.locator('.pk-me[data-turn]').count()) {
      await page.locator('.pk-call').click({ timeout: 2000 }).catch(() => {})
    }
    await page.waitForTimeout(300)
  }
  await expect(again).toBeVisible()
  await expectRows(page, 'history', 1)
  expect((await readTable(page, 'history'))[0]).toMatchObject({ gameId: 'poker' })
})

test('pressing F folds when it is your turn', async ({ page }) => {
  await page.goto('/play/poker?seed=e2e-poker-key')
  await page.getByLabel('Opponents').selectOption('1')
  await page.getByRole('button', { name: 'Start tournament' }).click()
  await expect(page.locator('.pk-me[data-turn]')).toBeVisible({ timeout: 15000 })
  await page.keyboard.press('f')
  await expect(page.locator('.pk-me small')).toHaveText('Folded')
})
