# Ghata Bara

> **Update:** the owner's real board is a **7x7** cloth (13 X squares), not 10x10. The 7x7 is now the default board and the 5x5 stays as the quick version. The 7x7 rules are in the section "The 7x7 board" below; the rest of this page describes the 5x5 first built.

A faithful, local-first adaptation of the traditional four-player board game. Pure rules live in `src/games/ghata/rules.ts` (no React, no randomness: dice values are passed in), the computer player in `bot.ts`, the interface in `src/games/GhataBara.tsx`. Tests: `rules.test.ts` (engine, including seeded full games checked after every action) and `GhataBara.test.tsx` and `e2e/ghata-bara.spec.ts` (interface).

## Built

The 5x5 game for four seats, as specified: 25 squares (16 outer counterclockwise, 8 inner clockwise, Home in the centre; pawns turn in from the square before their own start), five safe squares, six pawns each, two long dice (1, 2, 3 and a blank; a blank counts 0 beside a numbered face and two blanks make 12, so results are 1 to 6 or 12), Chowka and Baara bonus rolls, the three-strike bust, whole indivisible movement chunks with free allocation and combination, mandatory use (no pass while a chunk has a legal use), outer-ring captures (one or two pawns), capture credit before entering the inner ring, automatic Juga formation, half-speed Juga movement, blockades, pinning with delayed capture, rescue, Juga-versus-Juga capture, Twin-Capture, chain pin-and-capture, exactly one capture bonus per allocation sequence, chained bonus sequences, capture checkpoints, exact Home entry and immediate victory.

Seats are Violet (player 1, bottom), Cyan (right), Amber (top), Rose (left); play goes counterclockwise from the bottom. One to four people can play; the computer plays the other seats. A game in progress is saved in this browser only.

## Not built

- The 10x10 variant (the plan says to start with 5x5; its rules are still unconfirmed).
- Online play, spectators, tournaments.
- Choosing which seats are people (two players sit opposite each other; three sit bottom, right and top).

A game is long: computer-only games take about 900 to 1,600 actions. That is the traditional pace of the game; a "short game" option could be added if wanted.

## Answers the owner gave to the open questions (section 20 of the brief)

| Question | Answer |
|---|---|
| Routes and the outer-to-inner transition | Each player starts on the safe square in the middle of their own edge. Following the owner's arrows, a pawn with capture credit turns inward from the outer square just before its own start (the one right after the corner), straight into the inner ring's corner above it, then goes up, along the top, down the right side and back along the bottom of the inner ring (8 squares clockwise), and Home is the next step. A pawn without credit goes past that square and its start and circles again. The 7x7 board follows the same drawing, one ring further in (see below). |
| Releasing with several qualifying rolls | One pawn per qualifying roll: each 6 or 12 in the queue can release one pawn. |
| Does Juga formation need credit for both pawns? | No separate check. Only pawns with capture credit can reach the inner ring, so any two same-player pawns meeting there qualify. |
| Is the three-strike counter reset between rolling sequences? | Yes. Every rolling sequence, including a capture-bonus one, counts its own strikes from zero. |

## Choices made where the brief is silent (please confirm or correct)

These are the places where the rules did not say, listed so nothing is silently invented. Each is one small, isolated change if you want it different.

1. **Capture credit belongs to the player** (owner's rule): once a player captures, all their pawns, in the yard or on the board, can enter the inner squares, and being captured later does not take it away (`RULES.creditSurvivesCapture`).
2. **"Once at least one opponent has entered the inner ring"** means: some other player has entered the inner ring at any time in this game. Pairs already waiting on an inner square become Jugas the moment that happens.
3. **A combined movement lands only on its final square.** The squares in between are passed over, and blockades apply to the whole path.
4. **The two-pawn limit also applies on start squares**, so a start square already holding two of your pawns cannot take a released pawn.
5. **A Juga may not land on a square holding one of its own single pawns.** (Friendly individual pawns cannot land on a friendly Juga, and the reverse is treated the same way.)
6. **A rescuing Juga and the pawn it frees share the square**; the rescuer does not repin it (as written), and if the rescuer later moves away nothing is captured.
7. **A capture credits the whole player (all pawns), including by a Juga**, including a delayed capture on leaving a pin and a captured Juga.
8. **A Juga needs an exact, even total to enter Home**, and any even total that does not overshoot is a legal movement.
9. **Pinning needs exactly one enemy single pawn** on the square. (A square cannot hold two opposing singles on the inner ring once Jugas exist, so this never arises.)
10. **Scores:** a finished game is reported as won if a person won; the score is 100 per Violet pawn home plus 400 for a win.

## Safe squares

`o0 o4 o8 o12` (the four edge centres, also the four start squares) and the Home square. Captures, pins and blockades do not apply on them. Jugas only ever stand on the inner ring, so in practice the safe-square exceptions matter for individual pawns and for Home.


## The 7x7 board

Built from the owner's photo of the cloth and a drawing of the directions. Squares: outer ring 24, middle ring 16, inner ring 8, Home 1 (49).

**Safe squares (13, as on the cloth):** the four corners, the four middles of the edges (these are also the starts), the centre (Home), and the four squares diagonally inside the corners.

**Starts:** each player starts on the X at the middle of their own edge (bottom for player 1, then right, top, left); waiting pawns sit in the Home Yard (shown in the player panel).

**Directions:** outer ring counterclockwise; middle and inner rings clockwise.

**Turning inward (the owner's arrows, bottom seat as the example):** a pawn walks the outer ring counterclockwise from its start square. Two squares before its own start (22 steps, the square after the bottom-left corner for the bottom seat) it turns up into the middle ring, if it has capture credit. A pawn with no capture goes past that square and its start, and circles again.

**Interior route (bottom seat):** up the left side of the middle ring, along its top, down its right side and back along its bottom, stopping at the square beside where it began (16 squares). Then up into the inner ring's bottom-left corner, up its left side, along its top, down its right side and back along its bottom (8 squares), and finally up into Home. Every seat walks the same route turned a quarter turn.

**Path of one pawn:** 22 steps round the outer ring to the turn square, then 24 interior squares (the whole middle ring, then the whole inner ring, both clockwise), then exactly one more step into Home.

### Choices made for the 7x7 (please confirm or correct)

1. **"Inner ring" means the whole interior** (middle and inner rings): capture credit is needed to enter the interior, and Jugas form and move anywhere in it.
2. **The middle ring is walked in full** before stepping into the inner ring, which it enters at the corner beside the middle ring's last square.
3. **A pawn that earns credit part-way round** turns in at its turn square when it next reaches it; an uncredited pawn passing the turn square goes round again.
4. **Superseded:** an earlier version turned pawns in from their own start square. The owner's arrow drawing replaced that (the 5x5 board is unchanged).
5. **Yards** are shown as dots in the player panel, not drawn as trays beside the board.
6. Everything else is as for the 5x5 (dice, bonus rolls, bust, chunks, captures, Jugas, pins, rescues, bonuses, exact Home).
