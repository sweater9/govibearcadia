import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Multiplayer lives behind /api (a Worker); the service worker must never answer those requests.
      workbox: { navigateFallbackDenylist: [/^\/api\//] },
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'GoVibeArcadia',
        short_name: 'Arcadia',
        description: 'A premium local-first browser arcade.',
        theme_color: '#090514',
        background_color: '#090514',
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
