import { expect, test } from '@playwright/test'
import { hitTarget, trackHosts } from './helpers'

test('a finished run can be shared: copy, plus WhatsApp, Telegram, X and Facebook links, and no request leaves the site', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const hosts = trackHosts(page)
  await page.clock.install()
  await page.goto('/play/pulse-tap')
  await page.getByRole('button', { name: 'Start run' }).click()
  await hitTarget(page)
  await page.clock.runFor(30_000)

  const group = page.getByRole('group', { name: 'Share on' })
  await expect(group).toBeVisible()
  const wa = group.getByRole('link', { name: 'WhatsApp' })
  await expect(wa).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=I%20scored%20100%20in%20Pulse%20Tap/)
  await expect(wa).toHaveAttribute('target', '_blank')
  for (const n of ['Telegram', 'X', 'Facebook']) await expect(group.getByRole('link', { name: n })).toBeVisible()

  await page.getByRole('button', { name: 'Share score' }).click()
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible()
  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(text).toMatch(/^I scored 100 in Pulse Tap on GoVibeArcade\. Can you beat it\? https?:\/\/[^ ]+\/play\/pulse-tap$/)
  expect([...hosts].filter((h) => /wa\.me|t\.me|twitter|facebook/.test(h))).toEqual([])
})
