# Quick match (matchmaking): design

Status: **design only, nothing built.** Written 2026-11-18 for the owner to approve. It follows `docs/PHASE3_PLAN.md` (slice 3.6, "quick match") and its rules: free Cloudflare plan, no chat, no accounts, no personal data, nothing hidden sent to a client.

## 1. What the player sees

On the Online page, each two-player game gets a **Find a match** button next to "Create room".

1. Press it. A waiting screen shows a timer, how many players are waiting for that game, and **Cancel**.
2. When another player is found, both see "Opponent found" for about two seconds and both land in a normal room and start playing.
3. If nobody is found after **20 seconds**, the screen offers three choices: keep waiting (up to 2 minutes), play the computer instead, or invite a friend (the existing private room link). It never pretends the computer is a person.

Games: Connect Four, Tic-Tac-Toe, Checkers, Nine Men's Morris, Battleship (the two-seat online games). Not World Trip: it has 2 to 6 seats and needs someone to press Start.

## 2. The hard part is not the code

The arcade is small, so most of the time the queue will be empty. A queue nobody joins feels broken. The design answers that in three ways:

- **Honest empty state** (the 20-second choice above), so a lone player is never stuck.
- **Real waiting counts** on the lobby ("1 waiting for Checkers"). This is the main thing that makes two strangers meet. The count is real, cached for 10 seconds, and shown only when it is above zero.
- **No skill matching.** With a few players, a rating system only makes people wait longer. First come, first paired.

Expect quick match to feel alive only when traffic grows. Private rooms stay the main way to play with friends.

## 3. How it works

A new Durable Object, `Matchmaker`, one instance per game (`idFromName(gameId)`), so games never block each other. It does **not** run the game. It only introduces two players and hands them a room code; the existing `Room` object, its seats, rules and reconnection are used unchanged.

```
client A  ──WS /api/match/<game>/ws?t=<token>──▶ Matchmaker(game)
client B  ──────────────same──────────────────▶   keeps a small FIFO list
                                                  two waiting: makeRoomCode(), send {type:"matched", code} to both
client A, B ──▶ /online?room=<code>&g=<game>  (the normal Room flow)
```

- **Protocol** (small JSON, 2 KB cap, versioned like the rooms): client sends `join` or `leave`; server sends `waiting {count}`, `matched {code}`, `timeout`, `error {reason}`.
- **Hibernation.** Waiting sockets use the WebSocket Hibernation API with auto-responding ping, so a waiting player costs no duration. A DO alarm expires entries after 2 minutes.
- **State.** The list lives in the object's storage (it must survive hibernation): `{ player: sha256(token), joinedAt }`. Raw tokens are never stored. A matched entry is kept for 60 seconds so a player whose connection dropped at the wrong moment gets the same room code back when they rejoin. Everything is deleted when matched, cancelled or expired. No logs.
- **Pure logic** lives in `src/lib/matchmaking.ts` (join, leave, expire, pair, rules below), with no Worker or browser APIs, so it is unit-tested like the room rules.

### Rules in the pure logic

- One entry per player token. A second tab with the same token replaces the first, so nobody can match themselves.
- **No rematch loop:** the same two tokens are not paired again within 10 minutes (stops two people farming each other through the queue; the leaderboard's cap of 3 counted wins per pair per day still applies on top).
- **Caps:** at most 200 waiting per game; the 201st gets `queue-full`.
- **Rate limit:** 10 joins per visitor per minute (the same best-effort limiter as rooms).
- **Kill switch:** if the environment variable `MATCHMAKING` is `off`, `/api/match/*` returns 503 and the lobby hides the button. Nothing else changes.

### If one player never arrives

Matched players get the code but one might close the tab. The other lands in a room that says "Waiting for opponent" (existing screen). After 15 seconds a new button, **Find another opponent**, puts them back in the queue.

## 4. Leaderboards and fair play

Quick-match wins count on the leaderboard under the existing rule: only when the winner opted in with a word-list nickname and both players were present and each made at least one move. Nicknames are shown to the opponent only if both players opted in; otherwise they are "Player 1/2" as today. No chat, no free text anywhere.

## 5. Free-tier cost

Per match: 2 WebSocket connects, 2 `join` messages (incoming WebSocket messages bill at 20 to 1), 2 `matched` sends, one alarm. Pings are auto-answered and free. That is about 5 billable requests per match, plus the match itself (about 10 for a turn-based game). Even at the free plan's 100,000 requests a day that is thousands of matches, far above what the rows-written limit of the rooms already allows (about 1,000 a day). Quick match does not change the limiting factor. If a limit is hit, only online play stops; single-player is unaffected.

## 6. Risks

- **Durable Object migration.** The new class needs migration `v3` (`new_sqlite_classes: ["Matchmaker"]`). Adding a class is harmless if unused, but removing it later needs a `deleted_classes` migration. As `CLAUDE.md` says, ship and check that migration **on its own**, before any lobby change uses it.
- **Empty queue** (section 2). Mitigated, not solved; it depends on traffic.
- **Abuse.** Anonymous tokens are free to create, so one person can open many tokens. The caps, the rate limit, the no-rematch rule and the leaderboard pair cap bound the damage; this is best effort, as for rooms.
- **Not verified on real networks.** Tests will use two browser contexts on `wrangler dev`; mobile networks that drop sockets are covered only by the reconnect design.

## 7. Build order (each slice is its own branch and draft PR)

| Slice | Content | Done when |
|---|---|---|
| M1 | `src/lib/matchmaking.ts` pure logic and unit tests | Pairing, expiry, same-token, no-rematch, caps all tested |
| M2 | `Matchmaker` Durable Object, `/api/match/<game>/ws`, migration v3, status endpoint, kill switch. **Ships alone, no UI.** | API test: two sockets are paired and receive the same valid room code; one socket times out; caps enforced |
| M3 | Lobby: Find a match button, waiting screen, 20-second choices, "Opponent found", Find another opponent | Two-browser e2e on desktop and phone: both land in the same room and make a move; cancel works; a third player keeps waiting |
| M4 | Waiting counts on the lobby; roadmap and docs update | Count matches the queue in an API test |

## 8. Decisions for the owner

1. **Wait time** before offering other choices: 20 seconds (proposed), maximum 2 minutes.
2. **Computer fallback** offered, clearly labelled as the computer: yes (proposed).
3. **Show nicknames to each other** when both opted in: yes (proposed); otherwise anonymous.
4. **Games:** the five two-seat games above (proposed).
5. **Waiting counts** shown publicly on the lobby: yes (proposed), real numbers only.
