# Phase 3 plan: multiplayer (draft for approval)

Status: **plan only, nothing built.** Written 2026-10-29. The roadmap says to assess free-tier limits and costs before implementing; this is that assessment plus a proposed build order.

## 1. What Phase 3 has to deliver

From `docs/ROADMAP.md`: private rooms with shareable codes, real-time play, guest play and reconnection (P0); leaderboards, friend challenges and matchmaking (P1); tournaments and spectator mode (P2). First games: Connect Four, Neon Pong, Tic-Tac-Toe, Battleship, Checkers. Architecture: lobby, Cloudflare Worker, Durable Object holding authoritative state and validating every move. Single-player must keep working if multiplayer is unavailable.

Existing games that already have pure rules we can run on the server: Connect Four (`connect4/rules.ts`) and Neon Pong (`pong/rules.ts`). Tic-Tac-Toe, Battleship and Checkers do not exist yet, so each needs a game built first.

## 2. Cloudflare free-tier numbers (from Cloudflare's docs, read on 2026-10-29)

Sources: Cloudflare [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing), [Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits), [Workers limits](https://developers.cloudflare.com/workers/platform/limits).

| Item | Free plan | Paid plan ($5/month minimum) |
|---|---|---|
| Durable Object requests (HTTP, WebSocket messages, alarms) | 100,000 per day | 1 million per month, then $0.15 per million |
| Incoming WebSocket messages | counted 20 to 1 as requests; outgoing messages free | same |
| Duration | 13,000 GB-s per day (128 MB per object, so about 104,000 object-seconds per day); idle objects that hibernate cost nothing | 400,000 GB-s per month, then $12.50 per million GB-s |
| SQLite rows written | 100,000 per day | 50 million per month |
| SQLite rows read | 5 million per day | 25 billion per month |
| SQLite storage | 5 GB total | 5 GB-month, then $0.20 per GB-month |
| Object type | SQLite-backed only | SQLite-backed |
| CPU | 10 ms per plain Worker HTTP request; objects get a 30 s budget that resets on every message | same |

Exceeding a daily free limit makes further operations of that type fail until 00:00 UTC. The docs page contradicts itself on the free per-object storage cap (10 GB vs 1 GB); it does not matter at our sizes.

Not verified here: whether requests for static files count against the 100,000 Worker requests per day. Cloudflare has historically not billed static asset requests, but I did not confirm that in the pages above.

### What that means in matches per day (my estimates, assumptions stated)

| Game | Assumption | Free-plan ceiling |
|---|---|---|
| Connect Four (turn-based, hibernating) | about 42 moves, about 10 billable requests per match, about 100 rows written per match | roughly 1,000 matches per day, limited by rows written |
| Neon Pong (real time, object awake for the whole match) | 3-minute match, 30 input messages per second per player, so about 560 requests and 22 GB-s per match | roughly 180 matches per day, limited by requests |

Conclusion: the free plan is enough for launch and early growth. If a game takes off, the Paid plan's $5 per month covers about 6,600 Pong matches per month from requests alone, so the cost risk is small and there is no surprise-bill path on the free plan (it stops instead of charging). Multiplayer is optional, so hitting a free limit only disables online play; single-player is unaffected.

## 3. Architecture

- One Worker in front of the existing static site. `wrangler.jsonc` gets `main`, a Durable Object binding and a migration with `new_sqlite_classes`. `assets.run_worker_first` is limited to `/api/*`, so every other request is served straight from the static assets exactly as today. A Worker bug cannot take the arcade pages down.
- One `Room` Durable Object per room. It holds the authoritative state, validates every move with the same pure rules the client uses, and broadcasts the new state. Clients never decide an outcome.
- Room codes: 6 characters from an alphabet without look-alike characters (no 0/O, 1/I/L), generated server-side, rooms expire after inactivity (Durable Object alarm).
- Guest play: a random player token kept in the browser. No accounts, no email, no personal data. The token is what lets a player reconnect to a seat after a dropped connection or reload.
- Turn-based games use the WebSocket Hibernation API with state written to SQLite after every move, so idle rooms cost no duration. Real-time Pong keeps the object awake only while a match runs.
- Protocol: small JSON messages, versioned, with a size limit and a per-connection rate limit. Unknown or malformed messages are dropped.
- Offline and PWA: the service worker must not cache or intercept `/api/*` or WebSocket upgrades. The lobby shows "multiplayer unavailable" when offline; single-player keeps working.
- No third-party requests: everything goes to our own origin, which keeps the "no third-party network requests" rule intact.

## 4. Safety and privacy decisions (need your approval)

1. **No chat in version 1.** Free text between strangers brings moderation and safety duties. Use fixed emotes at most.
2. **Nicknames.** Private rooms need no nickname (players are "Player 1/2"). Public leaderboards would need one; proposed as opt-in, picked from a word list (for example "Brave Otter 42") rather than free text, so nothing needs moderating.
3. **Quick match and leaderboards** (P1) come after private rooms are solid, because they need public identity and abuse handling.
4. Rooms and results hold no personal data. Results are not tied to anything but the browser token.

## 5. Build order

| Slice | Content | Done when |
|---|---|---|
| 3.0 Foundations | Worker entry, `wrangler.jsonc` changes, `/api/health`, empty `Room` object with a WebSocket echo, local `wrangler dev` test setup, CI/Workers Builds still green | Static site unchanged; two browser tabs can talk through a room in a test |
| 3.1 Rooms and Connect Four online | Create room, share code or link, join as guest, play with server-validated moves, rematch | Two real browser contexts finish a match; illegal and out-of-turn moves rejected |
| 3.2 Reconnection and hardening | Reload or drop and rejoin the same seat, opponent-left handling, rate limits, expiry, size limits | Test drops one side mid-match and resumes |
| 3.3 Tic-Tac-Toe and Checkers | New games with pure rules, single-player (computer opponent) and online | Same bar as slice 3.1 for each |
| 3.4 Neon Pong online | Server-side simulation, input messages, client prediction kept simple | Two clients complete a point; behaviour under latency documented |
| 3.5 Battleship | Hidden-information game, so the server must never send the opponent's ships | Test confirms the opponent's board is never in any message |
| 3.6 (P1) Friend challenges, leaderboards, quick match | Shareable challenge links, opt-in word-list nicknames, queue object | Decided after 3.1 to 3.5 |
| Later (P2) | Tournaments, spectators | Not planned yet |

Each slice follows the repo rules: pure rules plus tests, component tests under StrictMode, Playwright for real two-player flows, full lint, unit, build and e2e before it ships.

## 6. Risks

- **Testing real multiplayer needs new tooling.** The e2e server today is `vite preview`. Phase 3 needs `wrangler dev` (local Workers runtime) serving the built site plus the Worker, with two browser contexts. `wrangler` is already a tool Cloudflare's build uses; adding it as a dev dependency touches `package-lock.json` (restore the `libc` fields as `CLAUDE.md` requires).
- **Deploys go straight to production.** The Cloudflare build deploys on every push to the live branch. A Durable Object migration cannot be casually undone, so 3.0 should be deployed and checked on its own before anything depends on it. Non-production branch builds run `wrangler preview`, which may need extra configuration once the Worker has bindings; to be tested in 3.0.
- **I cannot observe production from here.** I can verify behaviour locally and through the build status, but not watch live traffic or read Cloudflare's dashboards. The first real two-device test needs you.
- **Real-time quality** (latency, cheating, mobile network drops) is harder than turn-based. That is why Pong comes after Connect Four and reconnection.

## 7. Decisions I need from you

1. Approve the plan and the build order above (or change the order).
2. Confirm: no chat in version 1.
3. Confirm: leaderboards later, with opt-in word-list nicknames only.
4. Stay on the free Cloudflare plan for now (my recommendation) and move to Paid ($5 per month) only if a limit is hit.
