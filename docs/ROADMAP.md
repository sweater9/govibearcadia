# GoVibeArcadia Roadmap

**Tagline:** Play Instantly. Explore Endlessly.

**Vision:** A free gaming destination that combines the convenience of instant browser games with the progression, community and polish of a dedicated gaming platform.

**Mission:** Make high-quality browser gaming accessible, enjoyable and privacy-friendly without mandatory subscriptions, accounts or downloads.

## Principles

- Independent brand, domain and repository. Separate from GoVibeTool and GoVibeMix 2.
- Free-to-play core. No mandatory registration, subscriptions or paid services.
- Local-first: core games never depend on external APIs. Progress lives in the browser (IndexedDB).
- Offline-capable wherever technically feasible (PWA).
- Mobile- and desktop-friendly. Premium futuristic arcade look: electric purple, neon cyan, midnight black.
- Privacy: no unnecessary tracking and no third-party requests from the app.
- Modular: each game is developed, tested and loaded independently (lazy-loaded).
- Release gates between phases. Quality over quantity: a few excellent games beat many unfinished ones.

## Technology

React, TypeScript, Vite, Tailwind CSS, Dexie (IndexedDB), vite-plugin-pwa, Vitest. Planned: Playwright for browser tests, Phaser where a game benefits from it, Cloudflare (static hosting now; Workers and Durable Objects for multiplayer later).

## Launch collection (target: 15 games)

These are development targets, not shipped. Only the games listed under "Status" exist today.

| # | Game | Category |
|---|------|----------|
| 1 | VibeLine | Original Puzzle |
| 2 | Twofold | Logic |
| 3 | Carve | Logic |
| 4 | 2048 Challenge | Numbers |
| 5 | Sudoku Master | Puzzle |
| 6 | Neon Snake | Retro |
| 7 | Space Defender | Arcade |
| 8 | Brick Breaker | Arcade |
| 9 | Minesweeper | Logic |
| 10 | Daily Word | Word |
| 11 | Memory Match | Brain |
| 12 | Neon Pong | Skill |
| 13 | Color Sort | Casual |
| 14 | Connect Four | Strategy |
| 15 | Gravity Flip | Platform Puzzle |

Neon Merge (the 2048-style game), Memory Grid (the matching game), Minesweeper, Neon Snake, Color Sort, Connect Four, Daily Word, Brick Breaker, Neon Pong, Sudoku Master, Space Defender and Gravity Flip currently fill the "2048 Challenge", "Memory Match", "Minesweeper", "Neon Snake", "Color Sort", "Connect Four", "Daily Word", "Brick Breaker", "Neon Pong", "Sudoku Master", "Space Defender" and "Gravity Flip" slots. Pulse Tap is an extra reaction game.

## Homepage and navigation (target)

Sections: Hero, Trending, Continue Playing, Daily Arcade, Quick Play, Puzzle & Logic, Retro Arcade, Discover (search and categories), Your Arcade Journey, New Releases.
Navigation: Home | Discover | Daily Arcade | Multiplayer | Achievements | Leaderboards. Multiplayer and online leaderboards are not Phase 1.

## Phases

### Phase 1: Foundation (in progress)

Playable arcade, premium responsive homepage, reusable game architecture, local progress, favorites and recently played, search and category filtering, offline PWA, automated tests. Target: 15 polished games, prioritising working and tested games over placeholders.

### Phase 2: Player engagement and retention

Highest priority after launch.

| Feature | Priority |
|---------|----------|
| Arcadia Passport (local player profile: progress, achievements, stats) | P0 |
| XP and levels | P0 |
| Daily challenges (deterministic, seeded by date) | P0 |
| Daily streaks | P0 |
| Achievements | P0 |
| Personal records (best scores and times) | P0 |
| Weekly challenges | P1 |
| Shareable results (no personal information) | P1 |
| Game recommendations from local preferences | P1 |
| Themes and avatars | P2 |

Technical approach: IndexedDB, deterministic daily challenges, local achievement calculation, optional export/import of progress. No account required.
Completion: daily challenges, achievements, streaks and progress work reliably across supported games, including offline.

### Phase 3: Multiplayer and social

Private rooms with shareable codes, real-time play, guest play, reconnection (all P0). Leaderboards, friend challenges, matchmaking (P1). Tournaments, spectator mode (P2).
Start with Connect Four, Neon Pong, Tic-Tac-Toe, Battleship, Checkers. Architecture: lobby, Cloudflare Worker, Durable Object holding authoritative state and validating every move. Single-player games must keep working if multiplayer is unavailable.
Assess free-tier limits and operating costs before implementation.
Completion: players can create rooms, join as guests, finish matches and reconnect without losing game integrity.

### Phase 4: Gaming universe expansion

Grow toward roughly 40 to 60 polished games (a target, not a release commitment). Three original flagships: Neon Circuit, Gravity Lab, Pixel Kingdom. Community events (weekly tournaments, seasonal challenges). Per-game pages with instructions, controls, accessibility notes and related games; useful content over mass-produced landing pages.
Completion: a larger, consistently maintained library, several distinctive originals, and measurable improvement in returning-player engagement.

### Phase 5: Platform expansion and sustainable growth

Enhanced PWA (P0), accessibility enhancements (P0), cloud sync (optional, P1), controller support (P1), localization (P1), desktop app (Tauri, P2), mobile apps (P2), creator platform (P2), monetization (P2). Improve the PWA before native apps; build native apps only on demonstrated demand; cloud sync must never be required for offline play.
Monetization options, only after growth and retention: unobtrusive ads, sponsored events, optional cosmetics, voluntary supporter memberships. Core games stay free; no forced ads; no pay-to-win.
Completion: reliable cross-device access, sustainable costs, and monetization that does not compromise free play.

## Status

| Item | Status |
|------|--------|
| Repository, stack, architecture | Done |
| Games implemented | 13: Neon Merge, Memory Grid, Pulse Tap, Minesweeper, Neon Snake, Color Sort, Connect Four, Daily Word, Brick Breaker, Neon Pong, Sudoku Master, Space Defender, Gravity Flip |
| Search, categories, favorites, recent play, high scores | Done |
| Lazy-loaded games, seeded randomness, game result contract | Done |
| Offline PWA with PNG icons | Done. Verified in headless Chromium: service worker precaches every game chunk, the app reloads and plays offline, manifest and icons are valid. Not yet verified on real devices (install prompt, iOS Safari). |
| Unit and component tests, lint | Done |
| Playwright browser tests | Done for Chromium (desktop and Pixel 7 emulation; the exact count is printed by `npm run test:e2e`) covering all games, persistence, offline, layout. Firefox and WebKit not covered. |
| Remaining launch games (3 of 15 slots remain; Neon Merge, Memory Grid, Minesweeper, Neon Snake, Color Sort, Connect Four, Daily Word, Brick Breaker, Neon Pong, Sudoku Master, Space Defender and Gravity Flip fill 12. Still to build: VibeLine, Twofold and Carve) | Not started |
| Domain purchase and configuration | Not confirmed |
| Production deployment | Not authorized |
