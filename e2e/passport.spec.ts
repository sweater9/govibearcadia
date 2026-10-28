import { expect, test, type Page } from '@playwright/test'
import { createRandom } from '../src/lib/rng'
import { dailyChallenge } from '../src/lib/passport'
import { newGame } from '../src/games/twofold/rules'
import { expectRows, overflowsHorizontally, readTable } from './helpers'

// Games eligible for the daily challenge (the `daily: true` entries in the registry). The home card is checked against this.
const DAILY_IDS = ['memory-grid', 'minesweeper', 'color-sort', 'daily-word', 'sudoku-master', 'vibeline', 'twofold', 'carve']

/** The first day from 1 Nov 2026 whose daily challenge is Twofold, which this spec can solve. */
const day = (() => {
  for (let i = 0; i < 90; i++) {
    const d = new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10)
    if (dailyChallenge(d, DAILY_IDS).gameId === 'twofold') return d
  }
  throw new Error('no twofold day found')
})()

async function solveTwofold(page: Page, seed: string) {
  const m = newGame(6, createRandom(seed))
  await expect(page.locator('.tf-board')).toBeVisible()
  for (const [i, v] of m.cells.entries()) {
    if (v !== -1) continue
    for (let k = 0; k <= m.puzzle.solution[i]; k++) await page.locator(`[data-cell="${i}"]`).click()
  }
  await expect(page.getByText(/Solved in/)).toBeVisible()
}

test('an empty passport shows level 1 and locked achievements, and does not overflow', async ({ page }) => {
  await page.goto('/passport')
  await expect(page.getByRole('heading', { name: 'Level 1' })).toBeVisible()
  await expect(page.locator('.pp-ach li.got')).toHaveCount(0)
  await expect(page.getByText('Play a game and your records')).toBeVisible()
  expect(await overflowsHorizontally(page)).toBe(false)
})

test("winning today's daily challenge earns XP, a streak day and achievements", async ({ page }) => {
  await page.clock.install({ time: new Date(`${day}T12:00:00Z`) })
  await page.goto('/')
  const card = page.getByLabel('Daily challenge')
  await expect(card).toContainText('Twofold')
  await expect(card).toContainText(day)
  await card.getByRole('link', { name: /Play today/ }).click()
  await expect(page.getByText(/Daily challenge · Logic/)).toBeVisible()
  await solveTwofold(page, day)
  await expectRows(page, 'history', 1)
  expect((await readTable(page, 'history'))[0]).toMatchObject({ gameId: 'twofold', won: true, daily: day })

  await page.goto('/passport')
  await expect(page.getByRole('heading', { name: 'Level 1' })).toBeVisible()
  await expect(page.getByText('75 / 100 XP to level 2 · 75 XP total')).toBeVisible()
  await expect(page.getByText('Day streak (best 1)')).toBeVisible()
  for (const id of ['first-play', 'first-win', 'daily-first']) await expect(page.locator(`.pp-ach li[data-id="${id}"]`)).toHaveClass(/got/)
  await expect(page.locator('.pp-ach li[data-id="streak-3"]')).not.toHaveClass(/got/)
  await expect(page.getByText('Done. Come back tomorrow')).toBeVisible()
  await expect(page.locator('.pp-records tbody tr')).toHaveCount(1)
  expect(await overflowsHorizontally(page)).toBe(false)
})

test('a forged daily link (wrong day) plays normally but does not count as the daily', async ({ page }) => {
  await page.clock.install({ time: new Date(`${day}T12:00:00Z`) })
  await page.goto(`/play/twofold?seed=${day}&daily=2000-01-01`)
  await expect(page.getByText(/Daily challenge/)).toHaveCount(0)
  await solveTwofold(page, day)
  await expectRows(page, 'history', 1)
  expect((await readTable(page, 'history'))[0]).not.toHaveProperty('daily')
  await page.goto('/passport')
  await expect(page.getByText('25 / 100 XP to level 2 · 25 XP total')).toBeVisible()
})

test('the passport works offline once loaded', async ({ page, context }) => {
  await page.goto('/passport')
  await expect(page.getByRole('heading', { name: 'Level 1' })).toBeVisible()
  await page.evaluate(() => navigator.serviceWorker?.ready)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Level 1' })).toBeVisible()
})

test('export then import into a fresh browser restores progress once; a bad file changes nothing', async ({ page, browser, baseURL }) => {
  await page.goto(`/play/twofold?seed=${day}`)
  await solveTwofold(page, day)
  await expectRows(page, 'history', 1)
  await page.goto('/passport')
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export progress' }).click()])
  expect(download.suggestedFilename()).toMatch(/^govibearcadia-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const file = await download.createReadStream().then(async (stream) => {
    const chunks: Buffer[] = []
    for await (const chunk of stream) chunks.push(chunk as Buffer)
    return Buffer.concat(chunks)
  })
  const parsed = JSON.parse(file.toString())
  expect(parsed).toMatchObject({ app: 'govibearcadia', version: 1 })
  expect(parsed.history).toHaveLength(1)

  const fresh = await browser.newContext({ baseURL })
  const other = await fresh.newPage()
  await other.goto('/passport')
  await expect(other.getByText('Play a game and your records')).toBeVisible()

  await other.getByLabel('Import file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"nope":true}') })
  await expect(other.getByRole('status').filter({ hasText: 'Import failed' })).toBeVisible()
  await expectRows(other, 'history', 0)

  await other.getByLabel('Import file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: file })
  await expect(other.getByText('Imported 1 new run')).toBeVisible()
  await expect(other.locator('.pp-records tbody tr')).toHaveCount(1)
  await expect(other.getByText('25 / 100 XP to level 2 · 25 XP total')).toBeVisible()

  await other.getByLabel('Import file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: file })
  await expect(other.getByText('Nothing new to import')).toBeVisible()
  await expectRows(other, 'history', 1)
  await fresh.close()
})

test('sharing a daily win and the passport copies plain text with no personal data', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.clock.install({ time: new Date(`${day}T12:00:00Z`) })
  await page.goto(`/play/twofold?seed=${day}&daily=${day}`)
  await solveTwofold(page, day)
  await page.getByRole('button', { name: 'Share result' }).click()
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible()
  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(text).toMatch(new RegExp(`^GoVibeArcadia daily ${day}: Twofold, [\\d,]+ points`))

  await page.goto('/passport')
  await page.getByRole('button', { name: 'Share my passport' }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('GoVibeArcadia passport: level 1 · 75 XP · 1-day streak · 3/10 achievements')
})
