import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { games } from '../data/games'
import { gameHead, gameTitle } from './gamePages'
import { fillHtml } from './seo'

const html = readFileSync('index.html', 'utf8')
const jsonLd = (out: string) => JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(out)![1])

describe('game pages', () => {
  it('every game gets its own title, address, picture and structured data, with no tokens left', () => {
    for (const g of games) {
      const out = fillHtml(html, 'https://example.test', gameHead(g, 'https://example.test'))
      expect(out, g.id).not.toMatch(/__[A-Z_]+__/)
      expect(out).toContain(`<title>${gameTitle(g).replaceAll('&', '&amp;')}</title>`)
      expect(out).toContain(`<link rel="canonical" href="https://example.test/play/${g.id}" />`)
      expect(out).toContain(`content="https://example.test/og/${g.id}.png"`)
      const data = jsonLd(out)
      expect(data['@type']).toBe('VideoGame')
      expect(data.name).toBe(g.title)
      expect(data.isAccessibleForFree).toBe(true)
    }
  })
  it('the home page keeps its own head', () => {
    const out = fillHtml(html, 'https://example.test')
    expect(out).toContain('content="https://example.test/og-image.png"')
    expect(jsonLd(out)['@type']).toBe('WebSite')
  })
  it('text in a title or description cannot break out of the tag or the script', () => {
    const g = { ...games[0], title: 'A "quoted" <b>game</b>', description: 'Tom & Jerry </script><script>x</script>' }
    const out = fillHtml(html, 'https://example.test', gameHead(g, 'https://example.test'))
    expect(out).not.toContain('<b>')
    expect(out).not.toContain('</script><script>x')
    expect(jsonLd(out).description).toBe(g.description)
  })
  it('a preview picture exists for every game', () => {
    for (const g of games) expect(() => readFileSync(`public/og/${g.id}.png`), g.id).not.toThrow()
  })
})
