import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    // Browser tests live in e2e/ and run with Playwright (`npm run test:e2e`).
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
