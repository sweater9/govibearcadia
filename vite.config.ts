import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Multiplayer lives behind /api (a Worker); the service worker must never answer those requests.
      workbox: { navigateFallbackDenylist: [/^\/api\//], globPatterns: ['**/*.{js,css,html,woff2}'], maximumFileSizeToCacheInBytes: 4 * 1024 * 1024 },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'GoVibeArcadia',
        short_name: 'Arcadia',
        description: 'A premium local-first browser arcade.',
        theme_color: '#faf3e8',
        background_color: '#faf3e8',
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
