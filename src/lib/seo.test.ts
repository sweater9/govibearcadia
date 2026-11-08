import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { games as GAMES } from '../data/games'
import { buildRobots, buildSitemap, fillHtml } from './seo'

describe('seo', () => {
  it('sitemap lists every game and the main pages', () => {
    const xml = buildSitemap(GAMES.map((g) => g.id), 'https://example.test')
    for (const g of GAMES) expect(xml).toContain(`<loc>https://example.test/play/${g.id}</loc>`)
    expect(xml).toContain('<loc>https://example.test/</loc>')
  })
  it('robots blocks the API and points at the sitemap', () => {
    const txt = buildRobots('https://example.test')
    expect(txt).toContain('Disallow: /api/')
    expect(txt).toContain('Sitemap: https://example.test/sitemap.xml')
  })
  it('fillHtml leaves no tokens in index.html', () => {
    const out = fillHtml(readFileSync('index.html', 'utf8'), 'https://example.test')
    expect(out).not.toMatch(/__[A-Z_]+__/)
    expect(out).toContain('https://example.test/og-image.png')
  })
})
