import { expect, test, type Page } from '@playwright/test'
import { expectRows, hitTarget, readTable } from './helpers'

const DIRECTIONS = ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'] as const
const LABELS = { ArrowLeft: 'Left', ArrowDown: 'Down', ArrowRight: 'Right', ArrowUp: 'Up' } as const

const mergeScore = async (page: Page) => Number(await page.locator('.game-toolbar strong').first().textContent())

/** Plays Neon Merge until at least one merge has scored. Uses touch on phones and the keyboard on desktop. */
async function scoreSomething(page: Page, useTouch: boolean) {
  for (let move = 0; move < 400 && (await mergeScore(page)) === 0; move++) {
    const key = DIRECTIONS[move % 4]
    if (useTouch) await page.getByRole('button', { name: LABELS[key], exact: true }).tap()
    else await page.keyboard.press(key)
  }
  expect(await mergeScore(page)).toBeGreaterThan(0)
}

test.describe('Neon Merge', () => {
  test('scores with the platform-appropriate controls and records the run once', async ({ page, isMobile }) => {
    await page.goto('/play/neon-merge')
    await expect(page.locator('.merge-tile')).toHaveCount(16)
    await scoreSomething(page, !!isMobile)

    const shown = await mergeScore(page)
    await page.getByRole('button', { name: 'New game' }).click()
    await expect(page.locator('.game-toolbar strong').first()).toHaveText('0')

    await expectRows(page, 'history', 1)
    const [row] = await readTable(page, 'history')
    expect(row).toMatchObject({ gameId: 'neon-merge', score: shown })
    const [progress] = await readTable(page, 'progress')
    expect(progress).toMatchObject({ gameId: 'neon-merge', highScore: shown, plays: 1 })
  })

  test('the on-screen pad works with a mouse click too', async ({ page }) => {
    await page.goto('/play/neon-merge')
    const before = await page.locator('.merge-board').innerText()
    for (let i = 0; i < 40; i++) await page.getByRole('button', { name: LABELS[DIRECTIONS[i % 4]], exact: true }).click()
    expect(await page.locator('.merge-board').innerText()).not.toBe(before)
  })

  test('a fresh game with no progress is not recorded', async ({ page }) => {
    await page.goto('/play/neon-merge')
    await page.getByRole('button', { name: 'New game' }).click()
    await page.getByRole('button', { name: 'New game' }).click()
    await page.waitForTimeout(400)
    await expectRows(page, 'history', 0)
  })
})

test('Memory Grid can be solved through the UI and records one winning run', async ({ page }) => {
  await page.goto('/play/memory-grid')
  const cards = page.locator('.memory-grid button')
  await expect(cards).toHaveCount(12)

  const symbolAt = new Array<string | null>(12).fill(null)
  const matched = new Set<number>()
  const reveal = async (index: number) => {
    await cards.nth(index).click()
    await expect(cards.nth(index)).not.toHaveAttribute('aria-label', 'Hidden card')
    symbolAt[index] = await cards.nth(index).getAttribute('aria-label')
  }
  const unknown = () => [...symbolAt.keys()].filter((i) => !matched.has(i) && symbolAt[i] === null)

  while (matched.size < 12) {
    // A pair we have already seen can be matched without guessing.
    const known = [...symbolAt.keys()].filter((i) => !matched.has(i) && symbolAt[i] !== null)
    const pair = known.flatMap((i) => known.filter((j) => j > i && symbolAt[j] === symbolAt[i]).map((j) => [i, j]))[0]
    if (pair) {
      await cards.nth(pair[0]).click()
      await cards.nth(pair[1]).click()
      matched.add(pair[0]).add(pair[1])
      continue
    }

    const [a, b] = unknown()
    await reveal(a)
    const partner = known.find((i) => symbolAt[i] === symbolAt[a])
    if (partner !== undefined) {
      await cards.nth(partner).click()
      matched.add(a).add(partner)
      continue
    }
    await reveal(b)
    if (symbolAt[a] === symbolAt[b]) {
      matched.add(a).add(b)
    } else {
      // A mismatch flips back by itself; wait for that before the next pick.
      await expect(cards.nth(a)).toHaveAttribute('aria-label', 'Hidden card')
      await expect(cards.nth(b)).toHaveAttribute('aria-label', 'Hidden card')
    }
  }

  await expect(page.getByText(/Perfect sync/)).toBeVisible()
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'memory-grid', won: true })
  expect(row.score as number).toBeGreaterThanOrEqual(100)
})

test('Memory Grid reset starts a fresh hidden board', async ({ page }) => {
  await page.goto('/play/memory-grid')
  const cards = page.locator('.memory-grid button')
  await cards.nth(0).click()
  await expect(cards.nth(0)).not.toHaveAttribute('aria-label', 'Hidden card')
  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(page.locator('.memory-grid button[aria-label="Hidden card"]')).toHaveCount(12)
})

test('Pulse Tap runs for 30 seconds, scores hits, and records one run', async ({ page }) => {
  await page.clock.install() // lets the 30-second run finish instantly and deterministically
  await page.goto('/play/pulse-tap')

  await page.getByRole('button', { name: 'Start run' }).click()
  for (let hit = 0; hit < 3; hit++) await hitTarget(page)
  await expect(page.locator('.game-toolbar strong').first()).toHaveText('300')

  await page.clock.runFor(30_000)
  await expect(page.getByText('Run complete')).toBeVisible()
  await expect(page.getByText('You scored 300.')).toBeVisible()

  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'pulse-tap', score: 300 })

  // Playing again produces a second, separate run.
  await page.getByRole('button', { name: 'Play again' }).click()
  await page.clock.runFor(30_000)
  await expectRows(page, 'history', 2)
})

test('Pulse Tap does not record anything if you never start', async ({ page }) => {
  await page.clock.install()
  await page.goto('/play/pulse-tap')
  await page.clock.runFor(60_000)
  await expectRows(page, 'history', 0)
})
