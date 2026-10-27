# GoVibeArcadia

A premium, independent, local-first browser arcade. Phase 1 ships three complete games, a responsive discovery experience, favorites and play history in IndexedDB, and offline PWA support.

## Included games

- **Neon Merge** — a keyboard- and touch-friendly 2048-style puzzle
- **Memory Grid** — a compact matching challenge
- **Pulse Tap** — a 30-second reaction game

The collection is deliberately small and functional. New games are added with a single entry in `src/games/registry.ts` (each game is lazy-loaded) as the arcade grows toward 15 polished titles. See `CLAUDE.md` for the add-a-game checklist and `docs/ROADMAP.md` for the long-term plan.

## Local development

```bash
npm ci
npm run dev
```

## Quality checks

```bash
npm run lint
npm test
npm run build
```

Progress, personal bests, recent plays, and favorites are stored only in the browser via IndexedDB. The service worker precaches the app for offline return visits.
