# GoVibeArcadia

A free, independent, local-first browser arcade: 29 games (puzzles, arcade, card and board games, with optional online rooms for some), no ads, no accounts, no trackers. Everything needed to play is bundled and works offline once loaded; progress stays in the browser.

Games are registered in `src/games/registry.ts` and lazy-loaded. See `CLAUDE.md` for the working rules and the add-a-game checklist, `docs/ROADMAP.md` for the plan, and `docs/` for per-game notes. `/about` explains what is stored and what is sent.

## Local development

```bash
npm ci
npm run dev
```

## Quality checks

```bash
npm run lint
npm test          # unit and component tests (Vitest)
npm run build
npm run test:e2e  # real-browser tests (Playwright); first run: npx playwright install chromium
```

Progress, personal bests, recent plays, and favorites are stored only in the browser via IndexedDB. The service worker precaches the app for offline return visits.

## Cloudflare Workers build settings

This repository builds a static React application. `wrangler.jsonc` tells Workers to serve `dist` and return the app for game navigation URLs such as `/play/neon-merge`.

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: repository root

The deploy command publishes the site; run it only when deployment is intended. For a local configuration check without publishing, run `npm run build` followed by `npx wrangler deploy --dry-run`.

A successful local build does not confirm that a Cloudflare dashboard build succeeded. Dashboard logs and the connected production branch must be checked separately.
