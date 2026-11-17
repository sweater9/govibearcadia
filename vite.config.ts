import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { GameMeta } from './src/types'
import { VitePWA } from 'vite-plugin-pwa'
import { createServer } from 'vite'
import { buildRobots, buildSitemap, fillHtml } from './src/lib/seo'
import { gameHead } from './src/lib/gamePages'
import { SITE_DESCRIPTION } from './src/site'

/** Fills the head tags in index.html and writes robots.txt and sitemap.xml (every game page, from the registry). */
const seo = (): Plugin => ({
  name: 'govibearcadia-seo',
  transformIndexHtml: (html) => fillHtml(html),
  generateBundle() {
    const ids = [...readFileSync('src/games/registry.ts', 'utf8').matchAll(/^\s{6}id: '([a-z0-9-]+)'/gm)].map((m) => m[1])
    this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: buildSitemap(ids) })
    this.emitFile({ type: 'asset', fileName: 'robots.txt', source: buildRobots() })
  },
  // One static page per game (dist/play/<id>.html, served at /play/<id>) so a crawler or a link preview sees that game's own head tags.
  async closeBundle() {
    const server = await createServer({ configFile: false, logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' })
    try {
      const { games } = (await server.ssrLoadModule('/src/data/games.ts')) as { games: GameMeta[] }
      const built = readFileSync('dist/index.html', 'utf8')
      // The built index.html has the bundle's script and style tags; each game page reuses them with its own head.
      const template = readFileSync('index.html', 'utf8')
      const assets = built.match(/<script type="module"[^>]*><\/script>|<link rel="(?:stylesheet|modulepreload)"[^>]*>/g) ?? []
      mkdirSync('dist/play', { recursive: true })
      for (const g of games) {
        const page = fillHtml(template, undefined, gameHead(g))
          .replace('<script type="module" src="/src/main.tsx"></script>', assets.filter((a) => a.startsWith('<script')).join('\n    '))
          .replace('</head>', `    ${assets.filter((a) => !a.startsWith('<script')).join('\n    ')}\n  </head>`)
        writeFileSync(`dist/play/${g.id}.html`, page)
      }
    } finally {
      await server.close()
    }
  },
})

export default defineConfig({
  plugins: [
    react(),
    seo(),
    VitePWA({
      registerType: 'autoUpdate',
      // Multiplayer lives behind /api (a Worker); the service worker must never answer those requests.
      workbox: { navigateFallbackDenylist: [/^\/api\//, /^\/(robots\.txt|sitemap\.xml|og-image\.png)$/], globPatterns: ['**/*.{js,css,html,woff2}'], globIgnores: ['play/**'], maximumFileSizeToCacheInBytes: 4 * 1024 * 1024 },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'GoVibeArcade',
        short_name: 'Arcade',
        description: SITE_DESCRIPTION,
        theme_color: '#0d131d',
        background_color: '#0d131d',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
