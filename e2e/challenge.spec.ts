import { expect, test, type Page } from '@playwright/test'
import { createRandom } from '../src/lib/rng'
import { cellsOf, newGame, scoreFor } from '../src/games/carve/rules'
import { challengePath } from '../src/lib/challenge'

// Friend challenges: a link deals the same seeded puzzle and says what to beat. Carve is solved with real drags.

const T0 = new Date('2026-10-28T10:00:00Z')
const SCORE = scoreFor(30) // every run below finishes at exactly 30 s

const centre = async (page: Page, cell: number) => {
  const box = (await page.locator(`[data-cell="${cell}"]`).boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
async function drag(page: Page, from: number, to: number) {
  const a = await centre(page, from)
  const b = await centre(page, to)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 4 })
  await page.mouse.up()
}

/** Opens a Carve page, then solves the puzzle dealt by `seed` in exactly 30 seconds. */
async function solve(page: Page, path: string, seed: string) {
  await page.clock.install({ time: T0 })
  await page.goto(path)
  await expect(page.locator('.cv-board')).toBeVisible()
  await page.clock.setFixedTime(T0)
  const rects = newGame(5, createRandom(seed)).puzzle.solution
  const span = (r: (typeof rects)[number]) => {
    const c = cellsOf(r, 5)
    return [c[0], c[c.length - 1]] as const
  }
  await drag(page, ...span(rects[0]))
  await page.clock.setFixedTime(new Date(T0.getTime() + 30_000))
  for (const r of rects.slice(1)) await drag(page, ...span(r))
  await expect(page.getByText(/Carved in 30s/)).toBeVisible()
}

test('a challenge link shows who you are playing against, and says whether you beat them', async ({ page }) => {
  const link = (beat: number, from?: string) => `/play/carve?seed=e2e-ch&beat=${beat}&w=1${from ? `&from=${from}` : ''}`
  await solve(page, link(1, '0.1.42'), 'e2e-ch')
  await expect(page.locator('.challenge-banner')).toContainText('Brave Falcon 42 won this with 1 on this puzzle.')
  await expect(page.getByRole('status').filter({ hasText: 'You beat' })).toHaveText(`You beat Brave Falcon 42: ${SCORE.toLocaleString()} against 1.`)
  await expect(page.getByRole('button', { name: 'Challenge back' })).toBeVisible()
})

test('a tie, and a score that is too high to beat', async ({ page }) => {
  await solve(page, `/play/carve?seed=e2e-ch&beat=${SCORE}&w=1`, 'e2e-ch')
  await expect(page.locator('.challenge-banner')).toContainText('A friend won this with')
  await expect(page.getByRole('status').filter({ hasText: 'tie' })).toHaveText(`A tie with your friend at ${SCORE.toLocaleString()}.`)
  const page2 = await page.context().newPage()
  await solve(page2, '/play/carve?seed=e2e-ch&beat=9999999&w=1', 'e2e-ch')
  await expect(page2.getByRole('status').filter({ hasText: 'Not this time' })).toContainText('Try again on the same puzzle')
})

test('a broken or hostile link is ignored: no banner, no error', async ({ page }) => {
  for (const q of ['seed=e2e&beat=abc&w=1', 'seed=e2e&beat=5&w=9', 'seed=<img src=x onerror=alert(1)>&beat=5&w=1', 'seed=e2e&beat=5&w=1&from=Evil%20Name']) {
    await page.goto(`/play/carve?${q}`)
    await expect(page.locator('.cv-board')).toBeVisible()
    await expect(page.locator('.challenge-banner')).toHaveCount(q.includes('from=') ? 1 : 0)
  }
  await expect(page.locator('.challenge-banner')).not.toContainText('Evil')
  await expect(page.locator('.challenge-banner')).toContainText('A friend')
})

test('a finished run can be sent to a friend: the link carries the puzzle and the score, and opens the same puzzle', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  // Math.random is fixed so the page's own fresh seed is known: every digit is index 18, the letter "s".
  await page.addInitScript(() => (Math.random = () => 0.5))
  const seed = 'ssssssssss'
  await solve(page, '/play/carve', seed)
  await page.getByRole('button', { name: 'Challenge a friend' }).click()
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible()
  const text = await page.evaluate(() => navigator.clipboard.readText())
  const url = text.match(/https?:\/\/\S+/)![0]
  expect(new URL(url).pathname + new URL(url).search).toBe(challengePath('carve', seed, { score: SCORE, won: true }, null))
  expect(text).toContain('I won Carve on GoVibeArcadia')

  const friend = await context.newPage()
  await solve(friend, url.replace(new URL(url).origin, ''), seed)
  await expect(friend.getByRole('status').filter({ hasText: 'tie' })).toBeVisible()
})

test('a nickname is shared only if the player opted in to the leaderboards', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.addInitScript(() => localStorage.setItem('govibearcadia.nick', JSON.stringify({ a: 1, n: 2, k: 7 })))
  await solve(page, '/play/carve?seed=e2e-nick', 'e2e-nick')
  await page.getByRole('button', { name: 'Challenge a friend' }).click()
  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(text).toContain('from=1.2.7')
})

test('only puzzles that can be re-dealt offer a challenge', async ({ page }) => {
  await page.goto('/play/neon-pong')
  await expect(page.locator('.pong-field')).toBeVisible()
  await expect(page.locator('.challenge-panel')).toHaveCount(0)
  await page.goto('/play/carve?seed=e2e-ch&beat=5&w=1')
  await expect(page.locator('.challenge-banner')).toBeVisible()
  await page.goto('/play/neon-pong?seed=e2e-ch&beat=5&w=1')
  await expect(page.locator('.challenge-banner')).toHaveCount(0)
})

test('the board stays fully on screen with a challenge line showing', async ({ page }) => {
  await page.goto('/play/carve?seed=e2e-ch&beat=5&w=1&from=0.1.42')
  await expect(page.locator('.challenge-banner')).toBeVisible()
  const box = (await page.locator('.cv-board').boundingBox())!
  const height = page.viewportSize()!.height
  expect(box.y + box.height).toBeLessThanOrEqual(height)
})
