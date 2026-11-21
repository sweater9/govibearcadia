# Maze Runner

Status (2026-11-21): **built, draft PR, not deployed.** Tested with unit, component and browser tests; not yet played by a person on a real phone, TV or controller.

## Modes

- **Campaign: 50 levels.** Mazes grow from 7x7 (level 1) to 21x21 (level 50). New things arrive gradually (`src/games/maze/levels.ts`, `campaignConfig`): coins at level 2, spikes at 4, locked doors and keys at 6, an enemy at 9, a countdown at 10, power-ups at 11, fog on even levels from 16, spikes that come and go from 20. Each level is generated from a fixed seed, so it is the same for everyone, and a test checks that all 50 are solvable without touching a spike. Levels unlock one at a time and your stars, best time and best score per level are saved on this device. Earn up to 3 stars: finish, collect every coin, finish under the par time.
- **Endless Maze:** a new maze each time (seeded from the browser's random source, or from `?seed=` for a repeatable run). Size, spikes, doors, enemies and fog grow with each maze; every maze has a countdown; hearts carry over and one comes back every third maze. The run ends when you lose all hearts or the time runs out. Your distance, time and number of mazes are tracked and the best ten runs are kept locally as your personal-best list. It is not an online leaderboard.

## Mechanics

Coins, keys and locked doors (a door needs one key, which it uses up), spikes (some toggle on a timer; stepping on an active one costs a heart), enemies that wander and chase when you are within six steps (touching one costs a heart), hearts (4 / 3 / 2 by difficulty), 1.2 seconds of protection after a hit, and five power-ups: speed boost (`»`), shield (`O`), reveal (`?`, uncovers fog nearby), extra time (`+`, 10 s) and freeze (`*`, enemies stop for 5 s). The countdown and the clock do not start until your first move. Pause with P or Escape; the game also pauses when the tab loses focus.

Settings: Easy / Normal / Hard (hearts, time allowed and enemy speed; the maze itself does not change) and an optional on-screen pad.

## Controls

Arrow keys or WASD (hold to keep moving, one extra keypress is remembered), swipe or drag on the maze (touch), the optional on-screen pad, or a game controller through the controller bridge (PR #121). Movement is eased between cells.

## Achievements

Eleven, saved locally: first exit, untouched, key master, fog walker, coin hoarder, level 10, level 25, level 50, star collector, and two Endless milestones (`storage.ts`).

## Verified

- Unit tests: maze generation (consistent walls, every cell reachable, perfect maze has cells-1 passages, determinism), solvability of all 50 campaign levels and 60 Endless mazes, the mechanics schedule, walls, doors and keys, a full solve with items, spikes and protection, shield, every power-up, the clock, enemies (walk, chase, freeze, damage), toggling spikes, fog, stars and score, difficulty scaling; save/load, unlock, bests and achievements.
- Component tests (StrictMode): opening state, movement, finishing level 1 reports `onFinish` exactly once and unlocks level 2, pause, the level menu and Endless, the on-screen pad.
- Browser tests (desktop and phone): a real-keyboard solve of level 1 and the saved result, pad movement, pause/Escape, Endless start; the shared layout spec (the maze is fully on screen without scrolling at laptop heights and on a 375x667 phone).

## Not verified

- Difficulty has not been tuned by play: the par times, star thresholds, enemy speeds and level pacing are my estimates, and later levels have only been checked for solvability, not for fun or fairness.
- Swipe and drag steering, the controller, and the on-screen pad on a real touch device were not tried by a person.
- The canvas drawing is checked only by looking at screenshots of levels 1, 20 and 30.
- **No music.** Sound effects (coin, key, door, hit, power-up, win, lose) use the arcade's existing optional sound setting; background music was not built.
- Achievements are limited to the eleven listed above. Progress is local to one browser.
