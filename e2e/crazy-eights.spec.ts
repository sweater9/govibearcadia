import { expect, test } from '@playwright/test'
import { expectRows, readTable } from './helpers'

const THINK = 780

test('plays a whole match against the computer with real input and saves it once', async ({ page }) => {
  test.setTimeout(420_000)
  await page.clock.install({ time: new Date('2026-11-15T10:00:00Z') })
  await page.goto('/play/crazy-eights?seed=e2e-ce')
  await expect(page.locator('.ce-felt')).toBeVisible()
  await page.getByRole('button', { name: /New game/ }).click()
  await page.getByLabel('Play to').selectOption('50')
  await page.getByRole('button', { name: 'Start game' }).click()
  await page.clock.pauseAt(new Date('2026-11-15T10:00:30Z'))
  const again = page.getByRole('button', { name: 'Play again' })
  const next = page.getByRole('button', { name: 'Next round' })
  const suit = page.getByRole('button', { name: /^Choose (Spades|Hearts|Diamonds|Clubs)$/ })
  const stock = page.getByRole('button', { name: /^Draw a card/ })
  const playable = page.locator('.ce-hand button[data-card]:not([disabled])')
  for (let guard = 0; guard < 4000 && !(await again.isVisible()); guard++) {
    if (await next.isVisible()) await next.click()
    else if ((await suit.count()) > 0) await suit.first().click()
    else if ((await playable.count()) > 0) await playable.first().click()
    else if (await stock.isEnabled()) await stock.click()
    await page.clock.runFor(THINK)
  }
  await expect(again).toBeVisible()
  const totals = (await page.locator('.ce-totals').innerText()).replace(/\s+/g, ' ')
  const mine = Number(/You (\d+)/.exec(totals)?.[1])
  const theirs = Number(/\(computer\) (\d+)/.exec(totals)?.[1])
  expect(Math.max(mine, theirs)).toBeGreaterThanOrEqual(50)
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'crazy-eights', won: mine > theirs })
  await page.clock.runFor(5000)
  await expectRows(page, 'history', 1)
})

test('keys play a card, D draws, P pauses and resumes', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-15T10:00:00Z') })
  await page.goto('/play/crazy-eights?seed=e2e-ce-keys')
  await expect(page.locator('.ce-hand button[data-card]')).toHaveCount(7)
  await page.clock.pauseAt(new Date('2026-11-15T10:00:30Z'))
  await page.keyboard.press('p')
  await expect(page.locator('.ce-overlay').getByText('Paused')).toBeVisible()
  await page.keyboard.press('p')
  await expect(page.locator('.ce-overlay')).toHaveCount(0)
  const count = async () => page.locator('.ce-hand button[data-card]').count()
  const before = await count()
  for (let guard = 0; guard < 20 && (await count()) === before; guard++) {
    if (await page.locator('.ce-hand button[data-card]:not([disabled])').count()) {
      const first = page.locator('.ce-hand button[data-card]:not([disabled])').first()
      const idx = await first.evaluate((el) => Array.from(el.parentElement?.children ?? []).indexOf(el))
      await page.keyboard.press(String(idx + 1))
      if (await page.getByRole('group', { name: /Choose a suit/ }).isVisible()) await page.keyboard.press('h')
    } else await page.keyboard.press('d')
    await page.clock.runFor(THINK)
  }
  expect(await count()).not.toBe(before)
})

test('four players with two humans: pass and play hides the hand until it is revealed', async ({ page }) => {
  await page.goto('/play/crazy-eights?seed=e2e-ce-hot')
  await page.getByRole('button', { name: /New game/ }).click()
  await page.getByLabel('Players').selectOption('4')
  await page.getByLabel('Humans on this device').selectOption('2')
  await page.getByRole('button', { name: 'Start game' }).click()
  await expect(page.locator('.ce-hand button[data-card]')).toHaveCount(0)
  await page.getByRole('button', { name: /^Show Player 1's hand$/ }).click()
  await expect(page.locator('.ce-hand button[data-card]')).toHaveCount(5)
  await expect(page.locator('.ce-seat')).toHaveCount(4)
})
