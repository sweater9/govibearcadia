import { expect, test, type Page } from '@playwright/test'
import { readTable } from './helpers'

/** Gives the player n won runs (20 coins each) straight in IndexedDB, as if they had played them. */
async function seedWins(page: Page, n: number) {
  await page.goto('/passport')
  await page.evaluate(async (count) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('govibearcadia')
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const db = open.result
        const tx = db.transaction('history', 'readwrite')
        for (let i = 0; i < count; i++) tx.objectStore('history').add({ gameId: 'neon-merge', score: 100 + i, won: true, playedAt: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString() })
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => reject(tx.error)
      }
    })
  }, n)
}

test('finishing a game earns coins that show in the header and on the result line', async ({ page }) => {
  await page.goto('/play/blackjack?seed=e2e-coins')
  await expect(page.getByLabel(/^\d+ coins$/)).toHaveText('0')
  await page.getByRole('button', { name: 'Start session' }).click()
  await page.getByRole('button', { name: 'Cash out' }).click()
  await expect(page.getByText('+5 coins earned')).toBeVisible()
  await expect(page.getByLabel('5 coins')).toBeVisible()
})

test('a theme can be bought with earned coins, stays after a reload, and cannot be bought twice', async ({ page }) => {
  await seedWins(page, 8) // 160 coins
  await page.reload()
  await expect(page.getByLabel('160 coins')).toBeVisible()
  await expect(page.getByRole('radio', { name: /Slate/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: /Buy Royal/ })).toBeDisabled() // 400
  await page.getByRole('button', { name: /Buy Slate/ }).click()
  await expect(page.getByLabel('10 coins')).toBeVisible()
  await expect(page.getByRole('button', { name: /Buy Slate/ })).toHaveCount(0)
  await page.getByRole('radio', { name: /Slate/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'slate')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'slate')
  expect((await readTable(page, 'wallet'))[0]).toMatchObject({ id: 'main', owned: ['slate'] })
})

test('the Blackjack bankroll carries over to the next session', async ({ page }) => {
  await page.goto('/play/blackjack?seed=e2e-bank')
  await page.getByRole('button', { name: 'Start session' }).click()
  await page.getByRole('button', { name: 'Deal' }).click()
  if (await page.getByRole('button', { name: 'Stand' }).isVisible()) await page.getByRole('button', { name: 'Stand' }).click()
  const chips = await page.locator('.bj-stats b').first().innerText()
  await page.getByRole('button', { name: 'Cash out' }).click()
  await expect(page.locator('.bj-status')).toContainText('Cashed out')
  expect((await readTable(page, 'wallet'))[0]).toMatchObject({ bankroll: Number(chips) })
  await page.getByRole('button', { name: 'New session' }).click()
  await expect(page.getByText('Started with')).toContainText(Number(chips) < 100 ? '1000' : chips)
})
