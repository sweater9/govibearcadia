# GoVibeArcadia

A premium, independent, local-first browser arcade. Phase 1 ships three complete games, a responsive discovery experience, favorites and play history in IndexedDB, and offline PWA support.

## Included games

- **Neon Merge** — a keyboard- and touch-friendly 2048-style puzzle
- **Memory Grid** — a compact matching challenge
- **Pulse Tap** — a 30-second reaction game

The collection is deliberately small and functional. New games can be registered in `src/data/games.ts` and mounted in `src/pages/Play.tsx` as the arcade grows toward 15 polished titles.

## Local development

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm test
npm run build
```

Progress, personal bests, recent plays, and favorites are stored only in the browser via IndexedDB. The service worker precaches the app for offline return visits.

## Cloudflare Workers build settings

This repository builds a static React application. `wrangler.jsonc` tells Workers to serve `dist` and return the app for game navigation URLs such as `/play/neon-merge`.

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Root directory: repository root

The deploy command publishes the site; run it only when deployment is intended. For a local configuration check without publishing, run `npm run build` followed by `npx wrangler deploy --dry-run`.

A successful local build does not confirm that a Cloudflare dashboard build succeeded. Dashboard logs and the connected production branch must be checked separately.
