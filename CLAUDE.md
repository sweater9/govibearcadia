# GoVibeArcadia: working rules

Independent, free-to-play, local-first browser arcade. The long-term plan is in `docs/ROADMAP.md`.

## Hard rules

- Do not modify GoVibeTool, GoVibeMix 2 or any other project.
- Never merge branches automatically. Open **draft** pull requests for review.
- Never deploy without explicit approval.
- No mandatory paid services. Core gameplay must not depend on cloud APIs.
- No third-party network requests from the app (no CDN fonts, analytics or trackers). Everything needed to play must be bundled and cacheable offline.
- Verify before calling anything done: `npm run lint`, `npm test`, `npm run build` and `npm run test:e2e` must all pass.
- Only claim what was verified. Do not describe unbuilt games or features as complete.

## Commands

- Install with `npm ci`, not `npm install`. `npm install` rewrites `package-lock.json` (it drops platform `libc` metadata) and creates noisy diffs. When a dependency really is added, restore the `libc` fields so the diff contains only the new package.
- `npm run dev`, `npm run lint`, `npm test`, `npm run build`.
- `npm run test:e2e`: Playwright against a fresh production build (it builds and serves it itself; it never reuses a running server, because that would test a stale build). Runs a desktop and a phone (Pixel 7) project. On a new machine run `npx playwright install chromium` first.

## End-to-end tests (`e2e/`)

- jsdom cannot see layout, the service worker, or real IndexedDB, so anything about those is tested here. Unit tests (Vitest) never run `e2e/`.
- Read IndexedDB with `readTable`/`expectRows` in `e2e/helpers.ts` to check what was actually saved.
- A favorite/progress write is committed only once the UI reflects it. Wait for that (for example the button label flipping) before reloading, or the test races the write.
- Use `page.clock.install()` and `clock.runFor()` for timed games instead of waiting in real time.
- `clock.install()` fakes timers but time keeps flowing; add `clock.setFixedTime()` when a test needs an exact time-based score.
- To test a seeded game exactly, import its pure rules into the spec and compute the layout the page will deal (see `e2e/minesweeper.spec.ts`), then play it through the real UI. Pure-rules files the e2e imports must be listed in `tsconfig.node.json`.
- Pulse Tap's target animates forever, so Playwright never sees it as stable; use `hitTarget`.
- Every game's play area must be fully on screen without scrolling at laptop heights (650 to 800px) and on a 375x667 phone. A timed game with targets below the fold, or under the sticky header, is unplayable. Add each new game to `PLAY_AREA` in `e2e/layout.spec.ts`; the CSS fits boards to the viewport at the end of `src/styles.css`.

## Architecture

- **Registry:** `src/games/registry.ts` is the single source of truth for games. `src/data/games.ts` only derives metadata from it. Games are lazy-loaded, so each becomes its own chunk.
- **Game contract** (`src/types.ts`): a game is a component taking `GameProps` (`onFinish(result: GameResult)`, optional `seed`). `GameResult` carries `score`, `durationMs`, `won` and `stats`; Phase 2 XP, achievements, records and daily challenges are computed from it.
- **Report once.** Call `onFinish` once per finished run, from an event handler or a dedicated effect. Never call it, or any other side effect, inside a state updater function: React StrictMode runs updaters twice and the run would be recorded twice.
- **Seeded randomness.** Use `createRandom(seed)` from `src/lib/rng.ts` for all game randomness, never `Math.random()` directly. With a seed the game must behave identically every time (daily challenges rely on this; `dailySeed()` gives the UTC date key).
- **Pure rules.** Keep game rules in plain TypeScript modules next to the component (see `merge/` and `memory/`), with no React or browser APIs, so a server can reuse them to validate moves in Phase 3.
- **`?seed=`:** `/play/<id>?seed=abc` passes the seed to the game, so the same seed always deals the same game. Daily challenges will use `dailySeed()` this way, and e2e tests use it for determinism.
- **Storage:** Dexie in `src/lib/db.ts`. Any schema change needs a new `this.version(n)` and a migration test in the style of `db.migration.test.ts`. Never edit a shipped version.

## Adding a game

1. Create `src/games/<Name>.tsx` implementing `GameProps`, with pure rules in `src/games/<name>/`.
2. Add one entry to `src/games/registry.ts` (metadata plus a `lazy()` import).
3. Add tests: pure rules, plus a StrictMode component test that checks `onFinish` is called exactly once per run.
4. Keyboard and touch controls must both work; check it at phone width.
5. Add the game to `PLAY_AREA` in `e2e/layout.spec.ts`, and write an e2e test that plays it with real input and checks the saved result.
6. Run lint, unit tests, build and e2e; open a draft PR.

## Git

Work on a feature branch; keep PRs focused. Commit messages: conventional style (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
