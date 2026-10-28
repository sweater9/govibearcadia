import { expect, type Page } from '@playwright/test'

export const GAMES = [
  { id: 'neon-merge', title: 'Neon Merge', category: 'Puzzle', chunk: 'NeonMerge' },
  { id: 'memory-grid', title: 'Memory Grid', category: 'Focus', chunk: 'MemoryGrid' },
  { id: 'pulse-tap', title: 'Pulse Tap', category: 'Arcade', chunk: 'PulseTap' },
  { id: 'minesweeper', title: 'Minesweeper', category: 'Logic', chunk: 'Minesweeper' },
  { id: 'neon-snake', title: 'Neon Snake', category: 'Retro', chunk: 'NeonSnake' },
  { id: 'color-sort', title: 'Color Sort', category: 'Puzzle', chunk: 'ColorSort' },
  { id: 'connect-four', title: 'Connect Four', category: 'Strategy', chunk: 'ConnectFour' },
  { id: 'daily-word', title: 'Daily Word', category: 'Word', chunk: 'DailyWord' },
] as const

type Row = Record<string, unknown>

/** Reads every row of an IndexedDB table straight from the browser, bypassing the app's own code. */
export async function readTable(page: Page, table: 'history' | 'progress' | 'favorites'): Promise<Row[]> {
  return page.evaluate(
    (name) =>
      new Promise<Row[]>((resolve, reject) => {
        const open = indexedDB.open('govibearcadia')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          if (!db.objectStoreNames.contains(name)) {
            db.close()
            resolve([])
            return
          }
          const request = db.transaction(name, 'readonly').objectStore(name).getAll()
          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            db.close()
            resolve(request.result as Row[])
          }
        }
      }),
    table,
  )
}

export const count = (page: Page, table: 'history' | 'progress' | 'favorites') =>
  readTable(page, table).then((rows) => rows.length)

/** Asserts a table has exactly `n` rows, and still has `n` after a short settle (catches late duplicates). */
export async function expectRows(page: Page, table: 'history' | 'progress' | 'favorites', n: number) {
  await expect.poll(() => count(page, table)).toBe(n)
  await page.waitForTimeout(400)
  expect(await count(page, table)).toBe(n)
}

/**
 * Taps the Pulse Tap target. The target pulses forever (a CSS scale animation), so Playwright can
 * never see it as "stable"; a forced click still lands on its centre, which is what a player does.
 */
export const hitTarget = (page: Page) => page.getByRole('button', { name: 'Tap target' }).click({ force: true })

/** True when the page scrolls sideways, which means something overflows the viewport. */
export const overflowsHorizontally = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

/** Collects the hostname of every request the page makes. */
export function trackHosts(page: Page): Set<string> {
  const hosts = new Set<string>()
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.protocol === 'http:' || url.protocol === 'https:') hosts.add(url.hostname)
  })
  return hosts
}
