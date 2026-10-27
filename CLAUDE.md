# GoVibeArcadia: working rules

Independent, free-to-play, local-first browser arcade. The long-term plan is in `docs/ROADMAP.md`.

## Hard rules

- Do not modify GoVibeTool, GoVibeMix 2 or any other project.
- Never merge branches automatically. Open **draft** pull requests for review.
- Never deploy without explicit approval.
- No mandatory paid services. Core gameplay must not depend on cloud APIs.
- No third-party network requests from the app (no CDN fonts, analytics or trackers). Everything needed to play must be bundled and cacheable offline.
- Verify before calling anything done: `npm run lint`, `npm test`, `npm run build` must all pass.
- Only claim what was verified. Do not describe unbuilt games or features as complete.

## Commands

- Install with `npm ci`, not `npm install`. `npm install` rewrites `package-lock.json` (it drops platform `libc` metadata) and creates noisy diffs. When a dependency really is added, restore the `libc` fields so the diff contains only the new package.
- `npm run dev`, `npm run lint`, `npm test`, `npm run build`.

## Architecture

- **Registry:** `src/games/registry.ts` is the single source of truth for games. `src/data/games.ts` only derives metadata from it. Games are lazy-loaded, so each becomes its own chunk.
- **Game contract** (`src/types.ts`): a game is a component taking `GameProps` (`onFinish(result: GameResult)`, optional `seed`). `GameResult` carries `score`, `durationMs`, `won` and `stats`; Phase 2 XP, achievements, records and daily challenges are computed from it.
- **Report once.** Call `onFinish` once per finished run, from an event handler or a dedicated effect. Never call it, or any other side effect, inside a state updater function: React StrictMode runs updaters twice and the run would be recorded twice.
- **Seeded randomness.** Use `createRandom(seed)` from `src/lib/rng.ts` for all game randomness, never `Math.random()` directly. With a seed the game must behave identically every time (daily challenges rely on this; `dailySeed()` gives the UTC date key).
- **Pure rules.** Keep game rules in plain TypeScript modules next to the component (see `merge/` and `memory/`), with no React or browser APIs, so a server can reuse them to validate moves in Phase 3.
- **Storage:** Dexie in `src/lib/db.ts`. Any schema change needs a new `this.version(n)` and a migration test in the style of `db.migration.test.ts`. Never edit a shipped version.

## Adding a game

1. Create `src/games/<Name>.tsx` implementing `GameProps`, with pure rules in `src/games/<name>/`.
2. Add one entry to `src/games/registry.ts` (metadata plus a `lazy()` import).
3. Add tests: pure rules, plus a StrictMode component test that checks `onFinish` is called exactly once per run.
4. Keyboard and touch controls must both work; check it at phone width.
5. Run lint, tests and build; open a draft PR.

## Git

Work on a feature branch; keep PRs focused. Commit messages: conventional style (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
