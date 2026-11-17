import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from '../site'

export const absoluteUrl = (path: string, base = SITE_URL) => `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`

export function buildSitemap(ids: string[], base = SITE_URL): string {
  const paths = ['/', '/passport', '/online', '/leaderboard', '/about', ...ids.map((id) => `/play/${id}`)]
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((p) => `  <url><loc>${absoluteUrl(p, base)}</loc></url>`).join('\n')}\n</urlset>\n`
}
export const buildRobots = (base = SITE_URL) => `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${absoluteUrl('/sitemap.xml', base)}\n`

export type PageHead = { title: string; description: string; url: string; image: string; imageAlt: string; jsonLd: unknown }

/** Head values for the home page and the pages that share it. */
export function homeHead(base = SITE_URL): PageHead {
  const root = base.replace(/\/$/, '')
  return {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: `${root}/`,
    image: `${root}/og-image.png`,
    imageAlt: 'GoVibeArcade: free browser games, no ads, no sign-up',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      alternateName: new URL(root).hostname,
      url: `${root}/`,
      description: SITE_DESCRIPTION,
      publisher: { '@type': 'Organization', name: SITE_NAME, url: `${root}/`, logo: `${root}/icon-512.png` },
    },
  }
}

const esc = (v: string) => v.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
/** JSON for a script tag: "<" is escaped so a value can never close the tag. */
const jsonForScript = (v: unknown) => JSON.stringify(v, null, 2).replaceAll('<', '\\u003c')

/** Replaces the __TOKENS__ in index.html with the site constants and the page's own head values (the home page's by default). */
export function fillHtml(html: string, base = SITE_URL, page: PageHead = homeHead(base)): string {
  return html
    .replaceAll('__JSON_LD__', () => jsonForScript(page.jsonLd))
    .replaceAll('__PAGE_TITLE__', () => esc(page.title))
    .replaceAll('__PAGE_DESCRIPTION__', () => esc(page.description))
    .replaceAll('__PAGE_URL__', () => page.url)
    .replaceAll('__OG_IMAGE__', () => page.image)
    .replaceAll('__OG_ALT__', () => esc(page.imageAlt))
    .replaceAll('__SITE_URL__', base.replace(/\/$/, ''))
    .replaceAll('__SITE_HOST__', new URL(base).hostname)
    .replaceAll('__SITE_NAME__', SITE_NAME)
    .replaceAll('__SITE_TITLE__', SITE_TITLE)
    .replaceAll('__SITE_DESCRIPTION__', SITE_DESCRIPTION)
}
