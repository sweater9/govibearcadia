import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { games as GAMES } from '../data/games'
import { SITE_DESCRIPTION } from '../site'
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
  it('index.html carries valid WebSite structured data built from the site constants', () => {
    const out = fillHtml(readFileSync('index.html', 'utf8'), 'https://example.test')
    const json = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(out)?.[1]
    const data = JSON.parse(json ?? '{}')
    expect(data['@type']).toBe('WebSite')
    expect(data.url).toBe('https://example.test/')
    expect(data.alternateName).toBe('example.test')
    expect(data.publisher.logo).toBe('https://example.test/icon-512.png')
    expect(data.description).toBe(SITE_DESCRIPTION)
  })
})
