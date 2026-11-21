# Maze Runner

Status (2026-11-22): **chase-style rework, draft PR, not deployed.** The first version (an exit-finding maze, deployed 2026-11-22) was not what the owner wanted: they asked for it to play like Pac-Man. This rework keeps the name and the maze engine and changes the goal. The player is a plain blue dot and the chasers are plain purple squares, deliberately not Pac-Man's look.

## How it plays

Eat every **pellet** in the maze to clear it (10 points each). **Chasers** (purple squares) hunt you; if one catches you, you lose a heart and restart at the start square with the chasers back home. A **big pink pellet** (50 points) turns the chasers blue for 7 seconds: they run away, slow down, and touching one eats it (200 points, doubling for each in a row up to 1,600) and sends it home. Lose all hearts and the run ends. Mazes have loops so you can run circles round the chasers.

- **Campaign: 50 levels.** Mazes grow from 7x7 to 21x21. Level 1 has one slow chaser; more (up to five) and faster chasers arrive as you go. Stars: clear it; clear it without being caught; clear it under par time. Progress, stars, best times and scores are saved on this device.
- **Endless:** a new maze each run, growing and adding chasers; hearts carry over, one comes back every third maze. Distance, time and mazes are tracked and your best ten runs are kept locally (not an online leaderboard).
- **Settings:** Practice (no chasers, 4 hearts), Easy, Normal, Hard (hearts, chaser speed), and an optional on-screen pad. A "How to play" list is on the level menu and the start hint explains each new thing.
- **Chaser behaviour:** within range they take the shortest route to you; some give up the chase now and then so they do not all stack up on you; when scared they flee. Their speed is set per level.
- **Controls:** arrow keys or WASD (hold to keep moving), swipe or drag, the on-screen pad, or a controller through the controller bridge (PR #121). P or Escape pauses; the clock starts on your first move.
- **Sound:** effects through the arcade's sound setting. No music.

The engine still supports exits, keys and doors, spikes, power-ups, countdowns and fog (used by the unit tests and not by any shipped level).

## Verified

- Unit tests: generation, determinism, all 50 campaign levels and Endless mazes built with every pellet reachable, level schedule (size and chaser count never go down), moving, pellet scoring, clearing a maze by eating every pellet, big pellet scare, eating scared chasers and the combo, being caught resets to start, scared chasers flee, stars, difficulty and Practice; save/load, unlock, bests and achievements.
- Component tests (StrictMode): opening state, movement, clearing level 1 reports `onFinish` exactly once and unlocks level 2, pause, menu, Endless, the pad.
- Browser tests (desktop and phone): clearing level 1 in Practice with the real keyboard and the saved result, pad, pause, Endless; the shared layout spec.

## Not verified

- **Chaser difficulty and fairness have not been tuned by play.** Speeds, scare time, par times and star thresholds are estimates; with chasers on, a real person has not cleared a level in a browser test (the browser test uses Practice).
- Whether it now feels like what the owner meant by "like Pac-Man".
- Swipe, controller and the pad on real devices.
- No music.
