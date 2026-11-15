import { expect, test } from '@playwright/test'
import { hitTarget } from './helpers'

const run = async (page: import('@playwright/test').Page, hits: number, again: boolean) => {
  await page.getByRole('button', { name: again ? 'Play again' : 'Start run' }).click()
  for (let i = 0; i < hits; i++) await hitTarget(page)
  await page.clock.runFor(30_000)
  await expect(page.getByText('Run complete')).toBeVisible()
}

test('the best score is shown, survives a reload, and a better run is announced as a new best', async ({ page }) => {
  await page.clock.install()
  await page.goto('/play/pulse-tap')
  await expect(page.locator('.personal-best')).toHaveCount(0) // nothing to show before the first run

  await run(page, 2, false)
  await expect(page.locator('.personal-best')).toHaveText('Your best: 200') // a first run sets the best quietly

  await run(page, 1, true)
  await expect(page.locator('.personal-best')).toHaveText('Your best: 200') // a worse run keeps it

  await run(page, 4, true)
  await expect(page.locator('.personal-best')).toHaveText('New best! 400')

  await page.reload()
  await expect(page.locator('.personal-best')).toHaveText('Your best: 400') // read back from saved progress
})
