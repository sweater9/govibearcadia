import { expect, test } from '@playwright/test'

// These games opted in to the daily challenge, which needs the same seed to deal the same game for everyone.
const DAILY = { 'marble-maze': '.mz-board', 'pixel-run': '.pr-field', 'tower-defense': '.td-board', 'rhythm-master': '.rm-field', 'ghata-bara': '.gb-board' } as const

for (const [id, selector] of Object.entries(DAILY)) {
  test(`${id}: the same daily seed deals the same game`, async ({ page }) => {
    const first = async (seed: string) => {
      await page.goto(`/play/${id}?seed=${seed}`)
      await expect(page.locator(selector)).toBeVisible()
      return page.locator(selector).innerHTML()
    }
    const a = await first('2026-11-16')
    const b = await first('2026-11-16')
    expect(b).toBe(a)
  })
}
