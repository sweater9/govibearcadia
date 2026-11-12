import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { VitePWA } from 'vite-plugin-pwa'
import { buildRobots, buildSitemap, fillHtml } from './src/lib/seo'
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
})

export default defineConfig({
  plugins: [
    react(),
    seo(),
    VitePWA({
      registerType: 'autoUpdate',
      // Multiplayer lives behind /api (a Worker); the service worker must never answer those requests.
      workbox: { navigateFallbackDenylist: [/^\/api\//, /^\/(robots\.txt|sitemap\.xml|og-image\.png)$/], globPatterns: ['**/*.{js,css,html,woff2}'], maximumFileSizeToCacheInBytes: 4 * 1024 * 1024 },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'GoVibeArcadia',
        short_name: 'Arcadia',
        description: SITE_DESCRIPTION,
        theme_color: '#181412',
        background_color: '#181412',
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
