// Draws a 1200x630 link-preview picture for every game into public/og/<id>.png.
// Usage: node scripts/og-games.cjs   (needs the built site's registry: run via vite-node style loader below)
const { chromium } = require('playwright')
const { createServer } = require('vite')
const path = require('node:path')
const fs = require('node:fs')
;(async () => {
  const server = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' })
  const { games } = await server.ssrLoadModule('/src/data/games.ts')
  await server.close()
  const out = path.join(__dirname, '..', 'public', 'og')
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
  const file = 'file://' + path.join(__dirname, 'og-game.html')
  for (const g of games) {
    const qs = new URLSearchParams({ t: g.title, d: g.description.length > 110 ? g.description.slice(0, 107).replace(/\s+\S*$/, '') + '…' : g.description, c: g.category, g: g.glyph })
    await page.goto(`${file}?${qs}`)
    await page.screenshot({ path: path.join(out, `${g.id}.png`) })
  }
  await browser.close()
  console.log(`wrote ${games.length} pictures`)
})()
