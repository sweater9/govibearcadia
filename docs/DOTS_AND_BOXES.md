# Dots and Boxes

Status (2026-11-21): **built, draft PR, not deployed.** Tested with unit, component and browser tests; not yet played by a person.

## How it plays

Take turns drawing one line between two neighbouring dots. Drawing the fourth side of a box takes that box and **you move again** (one line can finish two boxes at once). When every box is taken, the player with more boxes wins. Rules are in `src/games/dots/rules.ts` (pure TypeScript, no React).

- **Opponent:** the computer (Easy, Medium or Hard) or a friend on the same device. You are Player 1 (blue); the other side is amber. "Computer goes first" is a setting.
- **Board:** 3x3, 4x4, 5x5 or 6x6 boxes, or Custom: any rows and columns from 2 to 8.
- **Easy:** any legal line.
- **Medium:** takes a box whenever one is on offer; otherwise draws a line that does not leave a box with three sides; when every line gives something away, gives the fewest boxes.
- **Hard:** plays like Medium, and in the opening prefers safe lines that leave an even number of safe lines (the usual way to make the opponent open the first chain). Once 13 or fewer lines remain it searches the rest of the game exactly, so it plays the endgame perfectly, including declining the last two boxes of a chain to keep control. If the search ever exceeds its node budget it falls back to the Medium plan.
- **Quick match:** a named computer from quick match plays Easy (Ada, Mei), Medium (Zara) or Hard (Sophia, Ananya), and is always labelled "(computer)".
- **Features:** line-draw animation (off for reduced motion), live score with the player to move underlined, completed boxes filled and marked, "extra turn" shown in the status line, move history list, **Undo** (takes back your last turn, and the computer's replies to it; disabled once the game is over), play again, and a local record of the last ten games against the computer.
- **Local record:** wins, losses, draws and the last ten results are kept in this browser only (`localStorage`, key `govibearcadia.dots`).

## Controls

Click or tap a line, or Tab to a line and press Enter or Space (focus then moves to the next open line). With a controller, the D-pad moves between lines and A draws.

## Verified

- Unit tests (`src/games/dots/rules.test.ts`): geometry for several board sizes, turn order, extra turn after a box, one line completing two boxes, illegal lines ignored, game end and winner, undo and replay, full simulated games at all three levels and four board sizes (every computer line legal, boxes always add up), Medium and Hard take a free box, Medium avoids a third side, Hard's choice equals the exact search value, and Hard beats Easy over 12 seeded 3x3 games.
- Component tests (StrictMode): line click, computer replies, clicks ignored during the computer's turn, undo, extra turn, labelled computer, and `onFinish` called exactly once per finished game.
- Browser tests (`e2e/dots-and-boxes.spec.ts`, desktop and phone): a full 2x2 game with real clicks and the saved result, keyboard play with an extra turn, undo; plus the shared layout spec (board on screen without scrolling).

## Not verified

- No person has played it yet; Hard's strength against a strong human is untested (the opening heuristic is a simplification of full chain theory, and positions with more than 13 open lines are not solved).
- Hard's exact search is bounded; on large boards the early game is heuristic, not perfect.
- Medium and Hard have not been tuned for feel.
