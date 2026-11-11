import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from '../site'

export const absoluteUrl = (path: string, base = SITE_URL) => `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`

export function buildSitemap(ids: string[], base = SITE_URL): string {
  const paths = ['/', '/passport', '/online', '/leaderboard', '/about', ...ids.map((id) => `/play/${id}`)]
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((p) => `  <url><loc>${absoluteUrl(p, base)}</loc></url>`).join('\n')}\n</urlset>\n`
}
export const buildRobots = (base = SITE_URL) => `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${absoluteUrl('/sitemap.xml', base)}\n`

/** Replaces the __TOKENS__ in index.html with the site constants. */
export function fillHtml(html: string, base = SITE_URL): string {
  return html
    .replaceAll('__SITE_URL__', base.replace(/\/$/, ''))
    .replaceAll('__SITE_NAME__', SITE_NAME)
    .replaceAll('__SITE_TITLE__', SITE_TITLE)
    .replaceAll('__SITE_DESCRIPTION__', SITE_DESCRIPTION)
}
