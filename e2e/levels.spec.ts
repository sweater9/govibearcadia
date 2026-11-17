import { expect, test } from '@playwright/test'
import { hitTarget } from './helpers'

test('clearing a level unlocks the next, which is remembered; a short run offers a retry', async ({ page }) => {
  await page.clock.install()
  await page.goto('/play/pulse-tap')
  const bar = page.getByTestId('level-bar')
  const result = page.getByTestId('level-bar')
  await expect(bar).toContainText('Clear it with 1,500 points')
  await expect(page.getByRole('combobox', { name: 'Level' })).toHaveValue('1')

  // One hit is far short of the target: the level is not cleared and a retry is offered.
  await page.getByRole('button', { name: 'Start run' }).click()
  await hitTarget(page)
  await page.clock.runFor(30_000)
  await expect(result).toContainText('100 of 1,500: not cleared')
  await expect(page.getByRole('button', { name: 'Next level' })).toHaveCount(0)
  await result.getByRole('button', { name: 'Retry level 1' }).click()

  // Fifteen hits reach 1,500: cleared.
  await page.getByRole('button', { name: 'Start run' }).click()
  for (let i = 0; i < 15; i++) await hitTarget(page)
  await page.clock.runFor(30_000)
  await expect(result).toContainText('Cleared with 1,500')
  await result.getByRole('button', { name: 'Next level' }).click()
  await expect(bar).toContainText('Clear it with 1,700 points')
  await expect(page.getByRole('combobox', { name: 'Level' })).toHaveValue('2')

  // Unlocked levels are kept on this device: coming back starts at level 2, and level 1 can still be chosen.
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Level' })).toHaveValue('2')
  await page.getByRole('combobox', { name: 'Level' }).selectOption('1')
  await expect(bar).toContainText('Clear it with 1,500 points')
})

test('a daily challenge and a game without levels show no level bar', async ({ page }) => {
  await page.goto('/play/chess')
  await expect(page.getByTestId('level-bar')).toHaveCount(0)
})
