import type { GameMeta } from '../types'
import { SITE_NAME, SITE_URL } from '../site'
import type { PageHead } from './seo'

/** What a game page is called in search results and link previews. */
export const gameTitle = (g: Pick<GameMeta, 'title'>) => `${g.title}: play free online · ${SITE_NAME}`
export const gameDescription = (g: Pick<GameMeta, 'description'>) =>
  `${g.description} Free to play in your browser: no ads, no sign-up, works offline.`

/** Head values for one game's own page: its title, description, address, preview picture and structured data. */
export function gameHead(g: GameMeta, base = SITE_URL): PageHead {
  const root = base.replace(/\/$/, '')
  const url = `${root}/play/${g.id}`
  const image = `${root}/og/${g.id}.png`
  return {
    title: gameTitle(g),
    description: gameDescription(g),
    url,
    image,
    imageAlt: `${g.title} on ${SITE_NAME}`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'VideoGame',
      name: g.title,
      description: g.description,
      url,
      image,
      genre: g.category,
      gamePlatform: 'Web browser',
      applicationCategory: 'Game',
      operatingSystem: 'Any',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@type': 'Organization', name: SITE_NAME, url: `${root}/` },
    },
  }
}
