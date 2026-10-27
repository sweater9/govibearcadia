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
